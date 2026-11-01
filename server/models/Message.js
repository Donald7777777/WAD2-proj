const mongoose = require('mongoose');
const bus = require('../utils/events');

const messageSchema = new mongoose.Schema({
    trade: { type: mongoose.Schema.Types.ObjectId, ref: 'Trade', required: true },
    // Empty sender = system message (e.g. "Proposal accepted")
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: { type: String, required: true },
    imageUrl: { type: String, default: '' },
    type: { type: String, enum: ['text', 'system'], default: 'text' },
    // Optional, for system messages: only this user gets a notification for it (both still see it in the chat)
    for: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Optional: the listing it's about (for competing-offer alerts)
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
    // System messages: who caused it (they don't get notified about their own action) and what
    // kind of event it is (e.g. 'accepted'), so notifications never have to guess from the wording
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    kind: { type: String, default: '' }
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

// extra (all optional): { kind, by: userId who caused it, for: the only user to notify, listing: listingId }
exports.addSystemMessage = async (tradeId, text, extra = {}) => {
    const message = await Message.create({ trade: tradeId, text, type: 'system', ...extra });
    bus.emit('message', message);
    return message;
};
