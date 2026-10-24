// A tiny in-memory event bus. When a chat message or trade event is saved, the Message model
// announces it here, and the live notification stream (messageController.streamNotifications)
// pushes it to the other person straight away.
const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(0); // one listener per open browser tab

module.exports = bus;
