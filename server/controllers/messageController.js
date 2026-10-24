const Message = require('../models/Message');
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
// My own messages and my own actions are left out. The first catch-up call (no `after`) only
// returns the server time and trade statuses, so you hear about things after you open the site.
const { Trade } = require('../models/Trade');
const bus = require('../utils/events');

// Work out what a trade event is from the system message the trade controller writes
function eventKind(text) {
    if (text.includes(' accepted the trade')) return 'accepted';
    if (text.includes(' rejected the proposal')) return 'rejected';
    if (text.includes(' countered:')) return 'countered';
    if (text.includes(' cancelled the trade')) return 'cancelled';
    if (text.includes(' asked ') && text.includes(' to add ')) return 'requested';
    if (text.includes(' declined to add ')) return 'requestDeclined';
    if (text.includes(' added ') && text.includes(' to the trade')) return 'itemsAdded';
    if (text.includes(' offered ')) return 'proposed';
    if (text.includes(' set the meetup')) return 'meetup';
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
        .map((m) => ({
            _id: m._id,
            // If this trade was cancelled/declined and you've since made a new trade with the same
            // person for the same item, open the new one instead of the closed one
            tradeId: linkTo.get(m.trade.toString()) || m.trade,
            kind: m.type === 'system' ? eventKind(m.text) : 'message',
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
            return res.json({ now, trades: tradeSummaries(trades, me), items: [] });
        }

        const messages = await Message.Message.find({
            trade: { $in: trades.map((t) => t._id) },
            createdAt: { $gt: after, $lte: now },
            $or: [{ type: 'system' }, { sender: { $ne: me } }]
        })
            .populate('sender', 'name')
            .sort({ createdAt: 1 })
            .limit(30);

        res.json({ now, trades: tradeSummaries(trades, me), items: buildItems(messages, me, req.session.userName || '', trades) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load notifications.' });
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
            if (saved.type !== 'system' && saved.sender?.toString() === me) return;
            const [message, trades] = await Promise.all([
                Message.Message.findById(saved._id).populate('sender', 'name'),
                loadMyTrades(me)
            ]);
            for (const item of buildItems([message], me, myName, trades)) {
                res.write(`event: notification\ndata: ${JSON.stringify(item)}\n\n`);
            }
        } catch (err) {
            console.error('Notification stream:', err.message);
        }
    };

    bus.on('message', onMessage);
    // A comment line every 25 s keeps proxies from closing an idle connection
    const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => {
        bus.off('message', onMessage);
        clearInterval(keepAlive);
    });
};
