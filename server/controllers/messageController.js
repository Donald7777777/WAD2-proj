const Message = require('../models/Message');
const User = require('../models/User');
const { getParticipantTrade } = require('./tradeController');

// GET /api/trades/:id/messages?after=<ISO date>
// The chat box polls this every few seconds for new messages
exports.getMessages = async (req, res) => {
    try {
        const trade = await getParticipantTrade(req, res);
        if (!trade) return;

        const messages = await Message.getMessages(trade._id, req.query.after);
        res.json(messages);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load messages.' });
    }
};

// POST /api/trades/:id/messages  { text, imageUrl }
exports.sendMessage = async (req, res) => {
    try {
        const trade = await getParticipantTrade(req, res);
        if (!trade) return;

        const me = req.session.userId;
        const idOf = (u) => (u?._id || u).toString();
        const other = idOf(trade.proposer) === me ? idOf(trade.receiver) : idOf(trade.proposer);
        if (await User.isBlockedBetween(me, other)) {
            return res.status(403).json({ error: "You can't message this user." });
        }

        const text = (req.body.text || '').trim();
        const imageUrl = req.body.imageUrl || '';
        if (!text && !imageUrl) {
            return res.status(400).json({ error: 'Message cannot be empty.' });
        }

        const message = await Message.addMessage({
            trade: trade._id,
            sender: req.session.userId,
            text: text || '(photo)',
            imageUrl
        });
        res.status(201).json(await message.populate('sender', 'name'));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to send message.' });
    }
};

// ---------- Notifications ----------
// Two ways to get notified about new chat messages and trade events across all my trades:
//   GET /api/notifications/stream   live: the server pushes each new one the moment it is saved
//   GET /api/notifications?after=   catch-up: everything since `after` (the app checks this every
//                                   10 s as a safety net, and whenever you come back to the tab)
// My own messages and my own actions are left out.
// The first call (no `after`) returns your recent history (last 14 days, for the bell) plus
// `seenAt` (when you last checked in) and `readAt` (when you last opened the bell): anything
// newer than seenAt happened while you were away, so the app can still pop it up.
const { Trade } = require('../models/Trade');
const { Reaction } = require('../models/Reaction');
const bus = require('../utils/events');

// Someone liked or saved one of my listings -> a notification item
function reactionItem(r) {
    return {
        _id: r._id,
        tradeId: null,
        listingId: r.listing?._id || r.listing,
        kind: r.kind === 'like' ? 'liked' : 'saved',
        from: r.user?.name || 'Someone',
        text: r.listing?.title || 'your listing',
        createdAt: r.createdAt
    };
}

function loadReaction(id) {
    return Reaction.findById(id).populate('user', 'name').populate('listing', 'title');
}

// Work out what a trade event is from the system message the trade controller writes
function eventKind(text) {
    if (text.includes(' accepted the trade')) return 'accepted';
    if (text.includes(' rejected the proposal')) return 'rejected';
    if (text.includes(' countered:')) return 'countered';
    if (text.includes(' cancelled the trade')) return 'cancelled';
    if (text.includes(' asked ') && text.includes(' to add ')) return 'requested';
    if (text.includes(' declined to add ')) return 'requestDeclined';
    if (text.includes(' added ') && text.includes(' to the trade')) return 'itemsAdded';
    if (text.startsWith('Heads up: ') && text.includes(' also made an offer for ')) return 'competitor';
    if (text.includes(' was traded to someone else')) return 'offerClosed';
    if (text.includes(' went to another trade, so this offer was withdrawn')) return 'offerWithdrawn';
    if (text.includes(' offered ') && text.includes('This is a competing offer')) return 'competingOffer';
    if (text.includes(' offered ')) return 'proposed';
    if (text.startsWith('Reminder: your meetup')) return 'reminder';
    if (text.startsWith("It's meetup time!")) return 'meetupNow';
    if (text.startsWith('Did the swap happen?')) return 'meetupOverdue';
    if (text.includes(' changed their offer: ')) return 'offerEdited';
    if (text.includes(' changed the meetup to ')) return 'meetupChanged';
    if (text.includes(' set the meetup')) return 'meetup';
    if (text.includes(' left ') && text.includes('-star review')) return 'reviewed';
    if (text.includes('Trade complete')) return 'completed';
    if (text.includes(' confirmed the handover')) return 'confirmed';
    return 'update';
}

// For each cancelled/declined trade: the newest later trade between the same two people that
// shares at least one item (e.g. you cancelled, then offered for the same item again)
function latestTradeFor(trades) {
    const closed = ['cancelled', 'rejected'];
    const pair = (t) => [t.proposer?._id.toString(), t.receiver?._id.toString()].sort().join(':');
    const items = (t) => new Set([...(t.requestedListings || []), ...(t.offeredListings || [])].map((id) => id.toString()));
    const map = new Map();
    for (const old of trades) {
        if (!closed.includes(old.status)) continue;
        const oldItems = items(old);
        const newer = trades
            .filter((t) => t !== old && t.createdAt > old.createdAt && pair(t) === pair(old)
                && [...items(t)].some((id) => oldItems.has(id)))
            .sort((a, b) => b.createdAt - a.createdAt)[0];
        if (newer) map.set(old._id.toString(), newer._id.toString());
    }
    return map;
}

const HISTORY_DAYS = 14;
const HISTORY_ITEMS = 30;

// Remember that I've seen everything up to `at` (so it isn't "missed" next time)
function markSeen(me, at) {
    return User.User.updateOne({ _id: me }, { $set: { notifSeenAt: at } }).catch(() => {});
}

function loadMyTrades(me) {
    return Trade.find({ $or: [{ proposer: me }, { receiver: me }] })
        .select('status proposer receiver requestedListings offeredListings createdAt')
        .populate('proposer', 'name')
        .populate('receiver', 'name');
}

function tradeSummaries(trades, me) {
    return trades.map((t) => {
        const iAmProposer = t.proposer?._id.toString() === me;
        return {
            _id: t._id,
            status: t.status,
            otherName: (iAmProposer ? t.receiver?.name : t.proposer?.name) || 'Someone'
        };
    });
}

// Turn saved messages into notification items for `me`
function buildItems(messages, me, myName, trades) {
    const summaries = tradeSummaries(trades, me);
    const names = new Map(summaries.map((t) => [t._id.toString(), t.otherName]));
    const linkTo = latestTradeFor(trades);
    return messages
        // Skip my own chat messages, and trade events I caused myself (they start with my name)
        .filter((m) => m.type === 'system' || m.sender?._id?.toString() !== me)
        .filter((m) => !(m.type === 'system' && myName && m.text.startsWith(`${myName} `)))
        // Messages meant for one person only (e.g. "you have a competitor")
        .filter((m) => !m.for || m.for.toString() === me)
        .map((m) => ({
            _id: m._id,
            // If this trade was cancelled/declined and you've since made a new trade with the same
            // person for the same item, open the new one instead of the closed one
            tradeId: linkTo.get(m.trade.toString()) || m.trade,
            kind: m.type === 'system' ? eventKind(m.text) : 'message',
            listingId: m.listing || null,
            from: m.type === 'system' ? names.get(m.trade.toString()) || 'Someone' : m.sender?.name || 'Someone',
            text: m.text === '(photo)' ? 'Sent a photo' : m.text,
            createdAt: m.createdAt
        }));
}

exports.getNotifications = async (req, res) => {
    try {
        const me = req.session.userId;
        const now = new Date();
        const trades = await loadMyTrades(me);

        const after = req.query.after ? new Date(req.query.after) : null;
        if (!after || isNaN(after)) {
            // First call: your recent history for the bell, and what you missed while away
            const since = new Date(now - HISTORY_DAYS * 86400000);
            const user = await User.User.findById(me).select('notifSeenAt notifReadAt');
            const [messages, reactions] = await Promise.all([
                Message.Message.find({
                    trade: { $in: trades.map((t) => t._id) },
                    createdAt: { $gt: since, $lte: now },
                    $or: [{ type: 'system' }, { sender: { $ne: me } }]
                }).populate('sender', 'name').sort({ createdAt: -1 }).limit(60),
                Reaction.find({ owner: me, user: { $ne: me }, createdAt: { $gt: since, $lte: now } })
                    .populate('user', 'name').populate('listing', 'title').sort({ createdAt: -1 }).limit(30)
            ]);
            const items = [...buildItems(messages, me, req.session.userName || '', trades), ...reactions.map(reactionItem)]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, HISTORY_ITEMS)
                .reverse();
            await markSeen(me, now);
            return res.json({
                now,
                trades: tradeSummaries(trades, me),
                items,
                history: true,
                seenAt: user?.notifSeenAt || null,
                readAt: user?.notifReadAt || null
            });
        }

        const messages = await Message.Message.find({
            trade: { $in: trades.map((t) => t._id) },
            createdAt: { $gt: after, $lte: now },
            $or: [{ type: 'system' }, { sender: { $ne: me } }]
        })
            .populate('sender', 'name')
            .sort({ createdAt: 1 })
            .limit(30);

        // Likes and saves on my listings since `after`
        const reactions = await Reaction.find({ owner: me, user: { $ne: me }, createdAt: { $gt: after, $lte: now } })
            .populate('user', 'name')
            .populate('listing', 'title')
            .sort({ createdAt: 1 })
            .limit(30);

        const items = [...buildItems(messages, me, req.session.userName || '', trades), ...reactions.map(reactionItem)]
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        await markSeen(me, now);
        res.json({ now, trades: tradeSummaries(trades, me), items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load notifications.' });
    }
};

// POST /api/notifications/read: I opened the bell, so everything so far counts as read
exports.markNotificationsRead = async (req, res) => {
    try {
        const at = new Date();
        await User.User.updateOne({ _id: req.session.userId }, { $set: { notifReadAt: at } });
        res.json({ at });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to mark notifications as read.' });
    }
};

// GET /api/notifications/stream  (Server-Sent Events: the browser keeps this open)
exports.streamNotifications = (req, res) => {
    const me = req.session.userId;
    const myName = req.session.userName || '';

    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();
    res.write('retry: 3000\n\n'); // if the connection drops, the browser reconnects after 3 s

    const onMessage = async (saved) => {
        try {
            const trade = await Trade.findById(saved.trade).select('proposer receiver');
            if (!trade || ![trade.proposer.toString(), trade.receiver.toString()].includes(me)) return;
            if (saved.type !== 'system' && saved.sender?.toString() === me) {
                res.write(`event: chat\ndata: ${JSON.stringify({ tradeId: saved.trade.toString() })}\n\n`);
                return;
            }
            const [message, trades] = await Promise.all([
                Message.Message.findById(saved._id).populate('sender', 'name'),
                loadMyTrades(me)
            ]);
            for (const item of buildItems([message], me, myName, trades)) {
                res.write(`event: notification\ndata: ${JSON.stringify(item)}\n\n`);
                markSeen(me, new Date());
            }
            // The chat on the trade page refreshes straight away for every message, mine included
            res.write(`event: chat\ndata: ${JSON.stringify({ tradeId: saved.trade.toString() })}\n\n`);
        } catch (err) {
            console.error('Notification stream:', err.message);
        }
    };

    const onReaction = async (saved) => {
        try {
            if (saved.owner?.toString() !== me || saved.user?.toString() === me) return;
            const reaction = await loadReaction(saved._id);
            if (reaction) {
                res.write(`event: notification\ndata: ${JSON.stringify(reactionItem(reaction))}\n\n`);
                markSeen(me, new Date());
            }
        } catch (err) {
            console.error('Notification stream:', err.message);
        }
    };

    // The other trader is typing, or has read the chat
    const tradeEvent = (type) => async (data) => {
        try {
            if (data.user === me) return;
            const trade = await Trade.findById(data.trade).select('proposer receiver');
            if (!trade || ![trade.proposer.toString(), trade.receiver.toString()].includes(me)) return;
            res.write(`event: ${type}\ndata: ${JSON.stringify({ tradeId: data.trade, name: data.name, at: data.at })}\n\n`);
        } catch (err) {
            console.error('Notification stream:', err.message);
        }
    };
    const onTyping = tradeEvent('typing');
    const onRead = tradeEvent('read');

    bus.on('message', onMessage);
    bus.on('reaction', onReaction);
    bus.on('typing', onTyping);
    bus.on('read', onRead);
    // A comment line every 25 s keeps proxies from closing an idle connection
    const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => {
        bus.off('message', onMessage);
        bus.off('reaction', onReaction);
        bus.off('typing', onTyping);
        bus.off('read', onRead);
        clearInterval(keepAlive);
    });
};
