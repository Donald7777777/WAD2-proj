const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema({
    text: String,
    proposerChecked: { type: Boolean, default: false },
    receiverChecked: { type: Boolean, default: false }
}, { _id: false });

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
    receiverConfirmed: { type: Boolean, default: false }
}, { timestamps: true });

const Trade = mongoose.model('Trade', tradeSchema);

exports.Trade = Trade;

const populateFields = [
    { path: 'proposer', select: 'name' },
    { path: 'receiver', select: 'name' },
    { path: 'requestedListings' },
    { path: 'offeredListings' }
];

exports.findById = (id) => Trade.findById(id).populate(populateFields);

exports.getTradesForUser = (userId) =>
    Trade.find({ $or: [{ proposer: userId }, { receiver: userId }] })
        .populate(populateFields)
        .sort({ updatedAt: -1 });

exports.createTrade = (data) => Trade.create(data);
