const mongoose = require('mongoose');
const bus = require('../utils/events');

// One like or save of a listing, with when it happened.
// Listing.likes / Listing.saves hold the counts; these records power the
// "who liked / saved your listings" activity page and the notifications.
const reactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // the listing's owner
    kind: { type: String, enum: ['like', 'save'], required: true }
}, { timestamps: true });

reactionSchema.index({ user: 1, listing: 1, kind: 1 }, { unique: true });
reactionSchema.index({ owner: 1, createdAt: -1 });

const Reaction = mongoose.model('Reaction', reactionSchema);

exports.Reaction = Reaction;

// Record a like/save and announce it (for the owner's live notification)
exports.add = async (data) => {
    const reaction = await Reaction.findOneAndUpdate(
        { user: data.user, listing: data.listing, kind: data.kind },
        { $setOnInsert: data },
        { upsert: true, returnDocument: 'after' }
    );
    bus.emit('reaction', reaction);
    return reaction;
};

exports.remove = (data) => Reaction.deleteOne({ user: data.user, listing: data.listing, kind: data.kind });
