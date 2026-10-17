const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    condition: { type: String, required: true },
    // What the owner would like in return, e.g. "film lenses, turntable"
    lookingFor: { type: String, default: '' },
    // Image is stored in Supabase Storage; we keep its path and public URL
    imagePath: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    // available -> reserved (trade accepted) -> traded (handover confirmed)
    status: { type: String, enum: ['available', 'reserved', 'traded'], default: 'available' }
}, { timestamps: true });

const Listing = mongoose.model('Listing', listingSchema);

exports.Listing = Listing;

// Get listings with optional category filter, title search and sort
exports.retrieveAll = (filter, sort) => {
    const sortOption = sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };
    return Listing.find(filter).populate('owner', 'name').sort(sortOption);
};

exports.findById = (id) => Listing.findById(id).populate('owner', 'name wants');

exports.addListing = (data) => Listing.create(data);

exports.editListing = (id, data) => Listing.findByIdAndUpdate(id, data, { returnDocument: 'after' });

exports.deleteListing = (id) => Listing.findByIdAndDelete(id);

exports.setStatus = (ids, status) => Listing.updateMany({ _id: { $in: ids } }, { status });
