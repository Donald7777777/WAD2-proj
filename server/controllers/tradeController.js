const Trade = require('../models/Trade');
const Listing = require('../models/Listing');
const Message = require('../models/Message');
const { buildChecklist } = require('../utils/checklists');

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

// Check that every id is an available listing owned by ownerId
async function loadOwnedAvailable(ids, ownerId) {
    const listings = await Listing.Listing.find({ _id: { $in: ids } });
    const ok = listings.length === ids.length &&
        listings.every(l => l.owner.toString() === ownerId && l.status === 'available');
    return ok ? listings : null;
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

        const requested = await loadOwnedAvailable(requestedIds, receiverId);
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

        await Message.addSystemMessage(trade._id,
            `${req.session.userName} offered ${titlesOf(offered)} for ${titlesOf(requested)}.`);

        res.status(201).json(trade);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to send proposal.' });
    }
};

exports.getMyTrades = async (req, res) => {
    try {
        const trades = await Trade.getTradesForUser(req.session.userId);
        res.json(trades);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load trades.' });
    }
};

exports.getTradeById = async (req, res) => {
    try {
        const trade = await getParticipantTrade(req, res);
        if (trade) res.json(trade);
    } catch (err) {
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

        const allListings = [...trade.requestedListings, ...trade.offeredListings];
        if (allListings.some(l => l.status !== 'available')) {
            return res.status(400).json({ error: 'Some items are no longer available.' });
        }

        trade.status = 'accepted';
        trade.turn = null;
        trade.checklist = buildChecklist(allListings);
        await trade.save();
        await Listing.setStatus(allListings.map(l => l._id), 'reserved');

        await Message.addSystemMessage(trade._id,
            `${req.session.userName} accepted the trade. Pick a meetup point below.`);
        res.json(await Trade.findById(trade._id));
    } catch (err) {
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

        const requested = await loadOwnedAvailable(requestedIds, idOf(trade.receiver));
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
        console.error(err);
        res.status(500).json({ error: 'Failed to send counter offer.' });
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

        trade.meetup = { name, address, lat, lng, date, time, setBy: req.session.userId };
        await trade.save();

        await Message.addSystemMessage(trade._id,
            `${req.session.userName} set the meetup: ${name} on ${date} at ${time}.`);
        res.json(await Trade.findById(trade._id));
    } catch (err) {
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

        const index = Number(req.body.index);
        const item = trade.checklist[index];
        if (!item) {
            return res.status(400).json({ error: 'Checklist item not found.' });
        }

        const checked = Boolean(req.body.checked);
        if (isProposer(trade, req.session.userId)) {
            item.proposerChecked = checked;
            if (!checked) trade.proposerConfirmed = false;
        } else {
            item.receiverChecked = checked;
            if (!checked) trade.receiverConfirmed = false;
        }
        await trade.save();
        res.json(await Trade.findById(trade._id));
    } catch (err) {
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

        if (trade.proposerConfirmed && trade.receiverConfirmed) {
            trade.status = 'completed';
            const ids = [...trade.requestedListings, ...trade.offeredListings].map(l => l._id);
            await Listing.setStatus(ids, 'traded');
            await Message.addSystemMessage(trade._id, 'Both users confirmed the handover. Trade complete!');
        } else {
            await Message.addSystemMessage(trade._id,
                `${req.session.userName} confirmed the handover. Waiting for the other user.`);
        }

        await trade.save();
        res.json(await Trade.findById(trade._id));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to confirm handover.' });
    }
};

exports.getParticipantTrade = getParticipantTrade;
