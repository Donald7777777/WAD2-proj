const mongoose = require('mongoose');

// Someone reported a listing or a user (e.g. a scam, fake item, rude messages).
// Stored for the team to review in MongoDB; there's no admin screen yet.
const REASONS = ['scam', 'fake', 'offensive', 'harassment', 'no-show', 'prohibited', 'other'];

const reportSchema = new mongoose.Schema({
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['listing', 'user'], required: true },
    target: { type: mongoose.Schema.Types.ObjectId, required: true },
    reason: { type: String, enum: REASONS, required: true },
    details: { type: String, default: '', maxlength: 500 },
    status: { type: String, enum: ['open', 'reviewed'], default: 'open' }
}, { timestamps: true });

// One open report per person per thing (reporting again updates it)
reportSchema.index({ reporter: 1, targetType: 1, target: 1 });

const Report = mongoose.model('Report', reportSchema);

exports.Report = Report;
exports.REASONS = REASONS;
