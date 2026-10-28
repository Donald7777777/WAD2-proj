const Trade = require('../models/Trade');
const Listing = require('../models/Listing');
const Message = require('../models/Message');
const { buildChecklist } = require('../utils/checklists');
const User = require('../models/User');
const { Review } = require('../models/Review');
const bus = require('../utils/events');

// Two people changed the same trade at the same moment: the second one gets a friendly 409
function conflict(err, res) {
    if (err && err.name === 'VersionError') {
        res.status(409).json({ error: 'This trade was just changed by the other person. Check the latest version and try again.' });
        return true;
    }
    return false;
}

function idOf(value) {
    return (value && value._id ? value._id : value).toString();
}

// Load a trade and make sure the logged-in user is part of it.
// Sends the error response itself and returns null if not allowed.
async function getParticipantTrade(req, res) {
    const trade = await Trade.findById(req.params.id);
    if (!trade) {
        res.status(404).json({ error: 'Trade not found.' });
        return null;
    }
    const userId = req.session.userId;
    if (idOf(trade.proposer) !== userId && idOf(trade.receiver) !== userId) {
        res.status(403).json({ error: 'You are not part of this trade.' });
        return null;
    }
    return trade;
}

function isProposer(trade, userId) {
    return idOf(trade.proposer) === userId;
}

function otherUserId(trade, userId) {
    return isProposer(trade, userId) ? idOf(trade.receiver) : idOf(trade.proposer);
}

// Check that every id is a listing owned by ownerId that can still be traded.
// allowReserved: the owner's items may already be in an accepted trade (a competing offer)
async function loadOwnedAvailable(ids, ownerId, allowReserved = false) {
    const ok = allowReserved ? ['available', 'reserved'] : ['available'];
    const listings = await Listing.Listing.find({ _id: { $in: ids } });
    const valid = listings.length === ids.length &&
        listings.every(l => l.owner.toString() === ownerId && ok.includes(l.status));
    return valid ? listings : null;
}

// Other live trades (open or accepted) that include any of these listings
function liveTradesWith(listingIds, exceptTradeId) {
    return Trade.Trade.find({
        _id: { $ne: exceptTradeId },
        status: { $in: ['pending', 'countered', 'accepted'] },
        $or: [{ requestedListings: { $in: listingIds } }, { offeredListings: { $in: listingIds } }]
    });
}

// Your items can be in several open offers at once. When one of them goes through, your other
// open offers that use the same items are withdrawn (those items aren't free any more).
async function withdrawBidsUsing(listings, exceptTradeId) {
    const ids = listings.map(l => l._id);
    const others = await Trade.Trade.find({
        _id: { $ne: exceptTradeId },
        status: { $in: ['pending', 'countered'] },
        offeredListings: { $in: ids }
    });
    for (const other of others) {
        const used = listings.filter(l => other.offeredListings.some(id => id.toString() === l._id.toString()));
        other.status = 'cancelled';
        other.turn = null;
        await other.save();
        await Message.addSystemMessage(other._id,
            `${used.map(l => l.title).join(', ')} went to another trade, so this offer was withdrawn.`);
    }
    return others.length;
}

// A new offer for listings that already have offers: tell the other offerers they have a competitor.
// The message goes in each of their trades, but only the offerer is notified (not the owner).
async function warnCompetitors(trade, offererName, requested, ownerId) {
    const others = await liveTradesWith(requested.map(l => l._id), trade._id);
    for (const other of others) {
        const rival = idOf(other.proposer) === ownerId ? idOf(other.receiver) : idOf(other.proposer);
        if (rival === idOf(trade.proposer)) continue; // your own other offer
        const item = requested.find(l => [...other.requestedListings, ...other.offeredListings]
            .some(id => id.toString() === l._id.toString())) || requested[0];
        await Message.addSystemMessage(other._id,
            `Heads up: ${offererName} also made an offer for ${item.title}.`,
            { for: rival, listing: item._id });
    }
    return others.length;
}

function titlesOf(listings) {
    return listings.map(l => l.title).join(', ');
}

// POST /api/trades  { requestedListingIds: [...], offeredListingIds: [...] }
exports.createTrade = async (req, res) => {
    try {
        const userId = req.session.userId;
        const requestedIds = req.body.requestedListingIds || [];
        const offeredIds = req.body.offeredListingIds || [];

        if (requestedIds.length === 0 || offeredIds.length === 0) {
            return res.status(400).json({ error: 'Pick at least one item to offer.' });
        }

        const firstRequested = await Listing.Listing.findById(requestedIds[0]);
        if (!firstRequested) {
            return res.status(404).json({ error: 'Listing not found.' });
        }
        const receiverId = firstRequested.owner.toString();
        if (receiverId === userId) {
            return res.status(400).json({ error: 'You cannot trade with yourself.' });
        }
        if (await User.isBlockedBetween(userId, receiverId)) {
            return res.status(403).json({ error: "You can't trade with this user." });
        }
        // One offer per person per item: change your existing offer instead of sending another
        const existing = await Trade.Trade.findOne({
            proposer: userId,
            receiver: receiverId,
            status: { $in: ['pending', 'countered', 'accepted'] },
            requestedListings: { $in: requestedIds }
        }).select('_id status');
        if (existing) {
            return res.status(409).json({
                error: existing.status === 'accepted'
                    ? 'You already have an accepted trade for this item.'
                    : 'You already have an offer for this item. Change that offer instead.',
                tradeId: existing._id
            });
        }

        // Their items may be reserved (you're making a competing offer); yours must be free
        const requested = await loadOwnedAvailable(requestedIds, receiverId, true);
        const offered = await loadOwnedAvailable(offeredIds, userId);
        if (!requested || !offered) {
            return res.status(400).json({ error: 'Some items are no longer available.' });
        }

        const trade = await Trade.createTrade({
            proposer: userId,
            receiver: receiverId,
            requestedListings: requestedIds,
            offeredListings: offeredIds,
            turn: receiverId
        });

        const competing = await warnCompetitors(trade, req.session.userName, requested, receiverId);
        await Message.addSystemMessage(trade._id,
            `${req.session.userName} offered ${titlesOf(offered)} for ${titlesOf(requested)}.` +
            (competing ? ` This is a competing offer (${competing + 1} offers now).` : ''),
            { listing: requested[0]._id });

        res.status(201).json(trade);
    } catch (err) {
        if (conflict(err, res)) return;
        console.error(err);
        res.status(500).json({ error: 'Failed to send proposal.' });
    }
};

exports.getMyTrades = async (req, res) => {
    try {
        const me = req.session.userId;
        const trades = await Trade.getTradesForUser(me);
        const rows = await Promise.all(trades.map(async (trade) => {
            const t = trade.toJSON();
            const since = trade.lastRead?.get(me);
            t.unread = await Message.Message.countDocuments({
                trade: trade._id,
                type: 'text',
                sender: { $ne: me },
                ...(since ? { createdAt: { $gt: since } } : {})
            });
            const ids = [...trade.requestedListings, ...trade.offeredListings].filter(Boolean).map(l => l._id);
            t.reviewedByMe = trade.status === 'completed'
                ? Boolean(await Review.exists({ trade: trade._id, from: me }))
                : false;
            t.competing = ['pending', 'countered', 'accepted'].includes(trade.status)
                ? await Trade.Trade.countDocuments({
                    _id: { $ne: trade._id },
                    status: { $in: ['pending', 'countered', 'accepted'] },
                    $or: [{ requestedListings: { $in: ids } }, { offeredListings: { $in: ids } }]
                })
                : 0;
            return t;
        }));
        res.json(rows);
    } catch (err) {
        if (conflict(err, res)) return;
        console.error(err);
        res.status(500).json({ error: 'Failed to load trades.' });
    }
};

exports.getTradeById = async (req, res) => {
    try {
        const trade = await getParticipantTrade(req, res);
        if (trade) res.json(trade);
    } catch (err) {
        if (conflict(err, res)) return;
        console.error(err);
        res.status(500).json({ error: 'Failed to load trade.' });
    }
};

// Only the user whose turn it is can accept, reject or counter
function checkTurn(trade, userId, res) {
    if (!['pending', 'countered'].includes(trade.status)) {
        res.status(400).json({ error: 'This proposal is no longer open.' });
        return false;
    }
    if (idOf(trade.turn) !== userId) {
        res.status(400).json({ error: 'Waiting for the other user to respond.' });
        return false;
    }
    return true;
}

exports.acceptTrade = async (req, res) => {
    try {
        const trade = await getParticipantTrade(req, res);
        if (!trade || !checkTurn(trade, req.session.userId, res)) return;

        // The proposer's items must be free. The receiver's (the listing owner's) may be reserved
        // for another accepted trade: accepting this one switches to it and cancels that one.
        // (Only the receiver can be accepting here, or the receiver just countered, so it's their choice.)
        const allListings = [...trade.requestedListings, ...trade.offeredListings];
        const receiverId = idOf(trade.receiver);
        const blocked = allListings.some(l => l.status === 'traded'
            || (l.status === 'reserved' && idOf(l.owner) !== receiverId));
        if (blocked) {
            return res.status(400).json({ error: 'Some items are no longer available.' });
        }

        trade.status = 'accepted';
        trade.turn = null;
        // One set of checks per item, by its category (e.g. clothing checks for a clothing item)
        const names = {
            [idOf(trade.proposer)]: trade.proposer?.name || '',
            [idOf(trade.receiver)]: trade.receiver?.name || ''
        };
        trade.checklist = buildChecklist(allListings, names);
        await trade.save();

        const reserved = allListings.filter(l => l.status === 'reserved').map(l => l._id);
        if (reserved.length) {
            const conflicts = await liveTradesWith(reserved, trade._id);
            for (const old of conflicts.filter(t => t.status === 'accepted')) {
                const titles = allListings.filter(l => reserved.some(id => id.toString() === l._id.toString())).map(l => l.title).join(', ');
                await Listing.setStatus([...old.requestedListings, ...old.offeredListings], 'available');
                old.status = 'cancelled';
                old.turn = null;
                await old.save();
                await Message.addSystemMessage(old._id,
                    `${req.session.userName} cancelled the trade to go with another offer for ${titles}.`);
            }
        }

        await Listing.setStatus(allListings.map(l => l._id), 'reserved');

        await Message.addSystemMessage(trade._id,
            `${req.session.userName} accepted the trade. Pick a meetup point below.`);
        // Other open offers that were giving away any of these items are withdrawn
        await withdrawBidsUsing(allListings, trade._id);
        res.json(await Trade.findById(trade._id));
    } catch (err) {
        if (conflict(err, res)) return;
        console.error(err);
        res.status(500).json({ error: 'Failed to accept trade.' });
    }
};

exports.rejectTrade = async (req, res) => {
    try {
        const trade = await getParticipantTrade(req, res);
        if (!trade || !checkTurn(trade, req.session.userId, res)) return;

        trade.status = 'rejected';
        trade.turn = null;
        await trade.save();

        await Message.addSystemMessage(trade._id, `${req.session.userName} rejected the proposal.`);
        res.json(await Trade.findById(trade._id));
    } catch (err) {
        if (conflict(err, res)) return;
        console.error(err);
        res.status(500).json({ error: 'Failed to reject trade.' });
    }
};

// POST /api/trades/:id/counter  { requestedListingIds, offeredListingIds }
// Lets the responder change which items are on each side, then hands the turn back
exports.counterTrade = async (req, res) => {
    try {
        const userId = req.session.userId;
        const trade = await getParticipantTrade(req, res);
        if (!trade || !checkTurn(trade, userId, res)) return;

        const requestedIds = req.body.requestedListingIds || [];
        const offeredIds = req.body.offeredListingIds || [];
        if (requestedIds.length === 0 || offeredIds.length === 0) {
            return res.status(400).json({ error: 'Both sides need at least one item.' });
        }

        const requested = await loadOwnedAvailable(requestedIds, idOf(trade.receiver), true);
        const offered = await loadOwnedAvailable(offeredIds, idOf(trade.proposer));
        if (!requested || !offered) {
            return res.status(400).json({ error: 'Some items are no longer available.' });
        }

        trade.requestedListings = requestedIds;
        trade.offeredListings = offeredIds;
        trade.status = 'countered';
        trade.turn = otherUserId(trade, userId);
        await trade.save();

        await Message.addSystemMessage(trade._id,
            `${req.session.userName} countered: ${titlesOf(offered)} for ${titlesOf(requested)}.`);
        res.json(await Trade.findById(trade._id));
    } catch (err) {
        if (conflict(err, res)) return;
        console.error(err);
        res.status(500).json({ error: 'Failed to send counter offer.' });
    }
};

// ---------- "Could you add more?" ----------
// POST /api/trades/:id/requests  { listingIds: [...], note }
// While a proposal is open, either trader can ask the other to add more of their items,
// e.g. "I'd also like your top". The other trader then adds them (or other items) or declines.
exports.requestMore = async (req, res) => {
    try {
        const userId = req.session.userId;
        const trade = await getParticipantTrade(req, res);
        if (!trade) return;
        if (!['pending', 'countered'].includes(trade.status)) {
            return res.status(400).json({ error: 'You can only ask for more while the proposal is open.' });
        }
        if (trade.requests.some((r) => r.status === 'open' && idOf(r.by) === userId)) {
            return res.status(400).json({ error: 'You already have a request waiting for an answer.' });
        }

        const listingIds = Array.isArray(req.body.listingIds) ? req.body.listingIds.map(String) : [];
        const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 300) : '';
        if (listingIds.length === 0 && !note) {
            return res.status(400).json({ error: 'Pick an item or write what you would like.' });
        }

        const otherId = otherUserId(trade, userId);
        const inTrade = new Set([...trade.requestedListings, ...trade.offeredListings].map(idOf));
        let listings = [];
        if (listingIds.length) {
            listings = await loadOwnedAvailable(listingIds, otherId);
            if (!listings || listingIds.some((id) => inTrade.has(id))) {
                return res.status(400).json({ error: 'Some of those items are not available to add.' });
            }
        }

        trade.requests.push({ by: userId, listings: listingIds, note });
        await trade.save();

        const otherName = isProposer(trade, userId) ? trade.receiver.name : trade.proposer.name;
        const what = listings.length ? titlesOf(listings) : 'more items';
        await Message.addSystemMessage(trade._id,
            `${req.session.userName} asked ${otherName} to add ${what} to the trade.${note ? ` "${note}"` : ''}`);
        res.status(201).json(await Trade.findById(trade._id));
    } catch (err) {
        if (conflict(err, res)) return;
        console.error(err);
        res.status(500).json({ error: 'Failed to send your request.' });
    }
};

// POST /api/trades/:id/requests/:requestId/respond  { accept: true|false, listingIds? }
// The other trader answers. Adding items changes the deal, so (like a counter offer)
// it becomes the asker's turn to accept the new version.
exports.respondToRequest = async (req, res) => {
    try {
        const userId = req.session.userId;
        const trade = await getParticipantTrade(req, res);
        if (!trade) return;
        const request = trade.requests.id(req.params.requestId);
        if (!request || request.status !== 'open') {
            return res.status(404).json({ error: 'This request has already been answered.' });
        }
        if (idOf(request.by) === userId) {
            return res.status(400).json({ error: 'The other trader needs to answer this request.' });
        }
        if (!['pending', 'countered'].includes(trade.status)) {
            return res.status(400).json({ error: 'This proposal is no longer open.' });
        }

        if (!req.body.accept) {
            request.status = 'declined';
            await trade.save();
            const titles = request.listings.length ? titlesOf(request.listings) : 'more items';
            await Message.addSystemMessage(trade._id, `${req.session.userName} declined to add ${titles}.`);
            return res.json(await Trade.findById(trade._id));
        }

        // Add the requested items, or the ones the responder picked instead
        const chosen = Array.isArray(req.body.listingIds) && req.body.listingIds.length
            ? req.body.listingIds.map(String)
            : request.listings.map(idOf);
        if (chosen.length === 0) {
            return res.status(400).json({ error: 'Pick at least one of your items to add.' });
        }
        const inTrade = new Set([...trade.requestedListings, ...trade.offeredListings].map(idOf));
        const listings = await loadOwnedAvailable(chosen, userId);
        if (!listings || chosen.some((id) => inTrade.has(id))) {
            return res.status(400).json({ error: 'Some of those items are no longer available.' });
        }

        // The responder's items go on their side of the trade
        if (isProposer(trade, userId)) {
            trade.offeredListings = [...trade.offeredListings.map(idOf), ...chosen];
        } else {
            trade.requestedListings = [...trade.requestedListings.map(idOf), ...chosen];
        }
        request.status = 'added';
        trade.status = 'countered';
        trade.turn = idOf(request.by);
        await trade.save();

        await Message.addSystemMessage(trade._id,
            `${req.session.userName} added ${titlesOf(listings)} to the trade. Over to you to accept.`);
        res.json(await Trade.findById(trade._id));
    } catch (err) {
        if (conflict(err, res)) return;
        console.error(err);
        res.status(500).json({ error: 'Failed to answer the request.' });
    }
};

exports.cancelTrade = async (req, res) => {
    try {
        const trade = await getParticipantTrade(req, res);
        if (!trade) return;

        if (!['pending', 'countered', 'accepted'].includes(trade.status)) {
            return res.status(400).json({ error: 'This trade can no longer be cancelled.' });
        }

        // Release reserved items so they can be traded again
        if (trade.status === 'accepted') {
            const ids = [...trade.requestedListings, ...trade.offeredListings].map(l => l._id);
            await Listing.setStatus(ids, 'available');
        }

        trade.status = 'cancelled';
        trade.turn = null;
        await trade.save();

        await Message.addSystemMessage(trade._id, `${req.session.userName} cancelled the trade.`);
        res.json(await Trade.findById(trade._id));
    } catch (err) {
        if (conflict(err, res)) return;
        console.error(err);
        res.status(500).json({ error: 'Failed to cancel trade.' });
    }
};

// PUT /api/trades/:id/meetup  { name, address, lat, lng, date, time }
exports.setMeetup = async (req, res) => {
    try {
        const trade = await getParticipantTrade(req, res);
        if (!trade) return;

        if (trade.status !== 'accepted') {
            return res.status(400).json({ error: 'A meetup can only be set for an accepted trade.' });
        }

        const { name, address, lat, lng, date, time } = req.body;
        if (!name || lat == null || lng == null || !date || !time) {
            return res.status(400).json({ error: 'Pick a location, date and time.' });
        }
        // Only today or later, and not a time that has already passed
        const at = new Date(`${date}T${time}:00`);
        if (Number.isNaN(at.getTime())) {
            return res.status(400).json({ error: 'That date or time is not valid.' });
        }
        if (at < new Date(Date.now() - 5 * 60 * 1000)) {
            return res.status(400).json({ error: 'Pick a date and time in the future.' });
        }

        const when = new Date(`${date}T${time}:00+08:00`);
        if (Number.isNaN(when.getTime()) || when < new Date()) {
            return res.status(400).json({ error: 'Meetup must be in the future.' });
        }
        
        // Changing an existing meetup says what it was, so the other trader notices the change
        const before = trade.meetup?.name ? { ...trade.meetup.toObject?.() ?? trade.meetup } : null;
        trade.meetup = { name, address, lat, lng, date, time, setBy: req.session.userId };
        await trade.save();

        const changed = before && (before.name !== name || before.date !== date || before.time !== time
            || before.lat !== lat || before.lng !== lng);
        if (changed) {
            await Message.addSystemMessage(trade._id,
                `${req.session.userName} changed the meetup to ${name} on ${date} at ${time} (was ${before.name} on ${before.date} at ${before.time}).`);
        } else if (!before) {
            await Message.addSystemMessage(trade._id,
                `${req.session.userName} set the meetup: ${name} on ${date} at ${time}.`);
        }
        res.json(await Trade.findById(trade._id));
    } catch (err) {
        if (conflict(err, res)) return;
        console.error(err);
        res.status(500).json({ error: 'Failed to save meetup.' });
    }
};

// PUT /api/trades/:id/checklist  { index, checked }
exports.updateChecklist = async (req, res) => {
    try {
        const trade = await getParticipantTrade(req, res);
        if (!trade) return;

        if (trade.status !== 'accepted') {
            return res.status(400).json({ error: 'The checklist is only available for accepted trades.' });
        }

        //Prevent users from changing their checklist after confirmation
        const proposer = isProposer(trade, req.session.userId);
        if (proposer? trade.proposerConfirmed : trade.receiverConfirmed) {
            return res.status(400).json({
                error: 'You have already confirmed the handover.'
            });
        }

        const index = Number(req.body.index);
        const item = trade.checklist[index];
        if (!item) {
            return res.status(400).json({ error: 'Checklist item not found.' });
        }

        const checked = Boolean(req.body.checked);
        if (proposer) {
            item.proposerChecked = checked;
            if (!checked) trade.proposerConfirmed = false;
        } else {
            item.receiverChecked = checked;
            if (!checked) trade.receiverConfirmed = false;
        }
        await trade.save();
        res.json(await Trade.findById(trade._id));
    } catch (err) {
        if (conflict(err, res)) return;
        console.error(err);
        res.status(500).json({ error: 'Failed to update checklist.' });
    }
};

// POST /api/trades/:id/confirm
// Each user confirms after ticking every item; the trade completes when both confirm
exports.confirmHandover = async (req, res) => {
    try {
        const trade = await getParticipantTrade(req, res);
        if (!trade) return;

        if (trade.status !== 'accepted') {
            return res.status(400).json({ error: 'This trade is not ready for handover.' });
        }

        const proposer = isProposer(trade, req.session.userId);
        const allTicked = trade.checklist.every(item =>
            proposer ? item.proposerChecked : item.receiverChecked);
        if (!allTicked) {
            return res.status(400).json({ error: 'Tick every checklist item first.' });
        }

        if (proposer) {
            trade.proposerConfirmed = true;
        } else {
            trade.receiverConfirmed = true;
        }

        const completing = trade.proposerConfirmed && trade.receiverConfirmed;
        if (completing) trade.status = 'completed';
        await trade.save();

        if (completing) {
            const ids = [...trade.requestedListings, ...trade.offeredListings].map(l => l._id);
            await Listing.setStatus(ids, 'traded');
            await Message.addSystemMessage(trade._id, 'Both users confirmed the handover. Trade complete!');
            // Other offers for these items can't happen any more
            const allListings = [...trade.requestedListings, ...trade.offeredListings];
            const stale = await liveTradesWith(ids, trade._id);
            for (const other of stale) {
                const gone = allListings.filter(l => [...other.requestedListings, ...other.offeredListings]
                    .some(id => id.toString() === l._id.toString()));
                other.status = other.status === 'accepted' ? 'cancelled' : 'rejected';
                other.turn = null;
                await other.save();
                const freed = [...other.requestedListings, ...other.offeredListings]
                    .filter(id => !ids.some(t => t.toString() === id.toString()));
                if (freed.length) await Listing.setStatus(freed, 'available');
                await Message.addSystemMessage(other._id,
                    `${gone.map(l => l.title).join(', ')} was traded to someone else, so this offer is closed.`);
            }
        } else {
            await Message.addSystemMessage(trade._id,
                `${req.session.userName} confirmed the handover. Waiting for the other user.`);
        }

        res.json(await Trade.findById(trade._id));
    } catch (err) {
        if (conflict(err, res)) return;
        console.error(err);
        res.status(500).json({ error: 'Failed to confirm handover.' });
    }
};

// PUT /api/trades/:id/offer  { offeredListingIds }
// The proposer changes what they're offering while waiting for an answer
exports.editOffer = async (req, res) => {
    try {
        const userId = req.session.userId;
        const trade = await getParticipantTrade(req, res);
        if (!trade) return;
        if (!isProposer(trade, userId)) {
            return res.status(403).json({ error: 'Only the person who made the offer can change it.' });
        }
        if (!['pending', 'countered'].includes(trade.status)) {
            return res.status(400).json({ error: 'This offer can no longer be changed.' });
        }
        if (idOf(trade.turn) === userId) {
            return res.status(400).json({ error: 'It is your turn: use Counter to change the offer.' });
        }
        const offeredIds = req.body.offeredListingIds || [];
        if (offeredIds.length === 0) {
            return res.status(400).json({ error: 'Offer at least one item.' });
        }
        const offered = await loadOwnedAvailable(offeredIds, userId);
        if (!offered) {
            return res.status(400).json({ error: 'Some of your items are no longer available.' });
        }
        const before = trade.offeredListings.map(l => idOf(l)).sort().join(',');
        if (before === offeredIds.map(String).sort().join(',')) {
            return res.status(400).json({ error: "That's the same as your current offer." });
        }
        trade.offeredListings = offeredIds;
        await trade.save();
        await Message.addSystemMessage(trade._id,
            `${req.session.userName} changed their offer: ${titlesOf(offered)} for ${titlesOf(trade.requestedListings)}.`);
        res.json(await Trade.findById(trade._id));
    } catch (err) {
        if (conflict(err, res)) return;
        console.error(err);
        res.status(500).json({ error: 'Failed to change your offer.' });
    }
};

// POST /api/trades/:id/read: I've read the chat up to now (for unread counts and "Seen")
exports.markRead = async (req, res) => {
    try {
        const trade = await getParticipantTrade(req, res);
        if (!trade) return;
        const at = new Date();
        // A plain update, so it never clashes with other changes to the trade
        await Trade.Trade.updateOne({ _id: trade._id }, { $set: { [`lastRead.${req.session.userId}`]: at } });
        bus.emit('read', { trade: trade._id.toString(), user: req.session.userId, at });
        res.json({ at });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update the chat.' });
    }
};

// POST /api/trades/:id/typing: tell the other person I'm typing (nothing is saved)
exports.typing = async (req, res) => {
    try {
        const trade = await getParticipantTrade(req, res);
        if (!trade) return;
        bus.emit('typing', { trade: trade._id.toString(), user: req.session.userId, name: req.session.userName });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed.' });
    }
};

exports.getParticipantTrade = getParticipantTrade;
