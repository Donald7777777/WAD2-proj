const mongoose = require('mongoose');

// A rating (1-5 stars) and comment one trader leaves about the other after a completed trade
const reviewSchema = new mongoose.Schema({
    trade: { type: mongoose.Schema.Types.ObjectId, ref: 'Trade', required: true },
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', maxlength: 500 }
}, { timestamps: true });

// One review per person per trade
reviewSchema.index({ trade: 1, from: 1 }, { unique: true });
reviewSchema.index({ to: 1, createdAt: -1 });

const Review = mongoose.model('Review', reviewSchema);

exports.Review = Review;

// Average rating and number of reviews for each of the given users: Map(userId -> { average, count })
exports.ratingsFor = async (userIds) => {
    const rows = await Review.aggregate([
        { $match: { to: { $in: userIds.map((id) => new mongoose.Types.ObjectId(String(id))) } } },
        { $group: { _id: '$to', average: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    return new Map(rows.map((r) => [r._id.toString(), { average: Math.round(r.average * 10) / 10, count: r.count }]));
};
