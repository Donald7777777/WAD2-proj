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
