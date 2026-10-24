const mongoose = require('mongoose');
const bus = require('../utils/events');

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

// Every new message is also announced on the event bus, for live notifications
exports.addMessage = async (data) => {
    const message = await Message.create(data);
    bus.emit('message', message);
    return message;
};

exports.addSystemMessage = async (tradeId, text) => {
    const message = await Message.create({ trade: tradeId, text, type: 'system' });
    bus.emit('message', message);
    return message;
};
