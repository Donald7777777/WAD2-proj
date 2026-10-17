const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    trade: { type: mongoose.Schema.Types.ObjectId, ref: 'Trade', required: true },
    // Empty sender = system message (e.g. "Proposal accepted")
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: { type: String, required: true },
    imageUrl: { type: String, default: '' },
    type: { type: String, enum: ['text', 'system'], default: 'text' }
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);

exports.Message = Message;

// "after" lets the chat box fetch only messages newer than the last one it has
exports.getMessages = (tradeId, after) => {
    const filter = { trade: tradeId };
    if (after) {
        filter.createdAt = { $gt: new Date(after) };
    }
    return Message.find(filter).populate('sender', 'name').sort({ createdAt: 1 });
};

exports.addMessage = (data) => Message.create(data);

exports.addSystemMessage = (tradeId, text) =>
    Message.create({ trade: tradeId, text, type: 'system' });
