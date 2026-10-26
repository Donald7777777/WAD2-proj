const Message = require('../models/Message');
const { Review } = require('../models/Review');
const { getParticipantTrade } = require('./tradeController');

const idOf = (value) => (value && value._id ? value._id : value).toString();

// GET /api/trades/:id/review: the review I left on this trade, if any
exports.getMyReview = async (req, res) => {
    try {
        const trade = await getParticipantTrade(req, res);
        if (!trade) return;
        const review = await Review.findOne({ trade: trade._id, from: req.session.userId });
        res.json({ review });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load your review.' });
    }
};

// POST /api/trades/:id/review  { rating: 1-5, comment }: rate the other trader after the handover
exports.createReview = async (req, res) => {
    try {
        const me = req.session.userId;
        const trade = await getParticipantTrade(req, res);
        if (!trade) return;
        if (trade.status !== 'completed') {
            return res.status(400).json({ error: 'You can leave a review once the trade is complete.' });
        }
        const rating = Number(req.body.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Pick a rating from 1 to 5 stars.' });
        }
        const comment = typeof req.body.comment === 'string' ? req.body.comment.trim().slice(0, 500) : '';
        if (await Review.exists({ trade: trade._id, from: me })) {
            return res.status(400).json({ error: 'You have already reviewed this trade.' });
        }

        const iAmProposer = idOf(trade.proposer) === me;
        const to = iAmProposer ? idOf(trade.receiver) : idOf(trade.proposer);
        const otherName = (iAmProposer ? trade.receiver.name : trade.proposer.name) || 'the other trader';
        const review = await Review.create({ trade: trade._id, from: me, to, rating, comment });

        await Message.addSystemMessage(trade._id,
            `${req.session.userName} left ${otherName} a ${rating}-star review${comment ? `: "${comment}"` : '.'}`);
        res.status(201).json({ review });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save your review.' });
    }
};
