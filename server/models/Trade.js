const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema({
    text: String,
    proposerChecked: { type: Boolean, default: false },
    receiverChecked: { type: Boolean, default: false }
}, { _id: false });

// "Could you add more?": one trader asks the other to add items from their side
const addRequestSchema = new mongoose.Schema({
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Items of the other trader they'd like added (can be empty if they only left a note)
    listings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Listing' }],
    note: { type: String, default: '' },
    status: { type: String, enum: ['open', 'added', 'declined'], default: 'open' }
}, { timestamps: true });

const tradeSchema = new mongoose.Schema({
    proposer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // The receiver's item(s) the proposer wants
    requestedListings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Listing' }],
    // The proposer's item(s) offered in exchange
    offeredListings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Listing' }],
    // pending/countered -> accepted -> completed, or rejected/cancelled
    status: {
        type: String,
        enum: ['pending', 'countered', 'accepted', 'rejected', 'cancelled', 'completed'],
        default: 'pending'
    },
    // Whose turn it is to accept / reject / counter
    turn: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    meetup: {
        name: String,
        address: String,
        lat: Number,
        lng: Number,
        date: String,
        time: String,
        setBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    },
    checklist: [checklistItemSchema],
    proposerConfirmed: { type: Boolean, default: false },
    receiverConfirmed: { type: Boolean, default: false },
    requests: { type: [addRequestSchema], default: [] },
    // Chat: when each trader last read the chat, by user id (for unread counts and "Seen")
    lastRead: { type: Map, of: Date, default: () => new Map() }
}, {
    timestamps: true,
    // If two people change the same trade at the same moment (e.g. both press Accept),
    // the second save fails instead of silently overwriting the first
    optimisticConcurrency: true
});

const Trade = mongoose.model('Trade', tradeSchema);

exports.Trade = Trade;

const populateFields = [
    { path: 'proposer', select: 'name avatarUrl' },
    { path: 'receiver', select: 'name avatarUrl' },
    { path: 'requestedListings' },
    { path: 'offeredListings' },
    { path: 'requests.listings' }
];

exports.findById = (id) => Trade.findById(id).populate(populateFields);

exports.getTradesForUser = (userId) =>
    Trade.find({ $or: [{ proposer: userId }, { receiver: userId }] })
        .populate(populateFields)
        .sort({ updatedAt: -1 });

exports.createTrade = (data) => Trade.create(data);
