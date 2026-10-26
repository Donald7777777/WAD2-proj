const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    condition: { type: String, required: true },
    // What the owner would like in return, e.g. "film lenses, turntable"
    lookingFor: { type: String, default: '' },
    // Images are stored in Supabase Storage; we keep each one's path and public URL.
    // `images` holds all photos (first = cover). imagePath/imageUrl always mirror the cover,
    // so everything that shows a single photo (cards, trades) keeps working.
    images: { type: [{ path: { type: String, default: '' }, url: { type: String, required: true }, _id: false }], default: [] },
    imagePath: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    // Who has liked (heart) and saved (bookmark) this listing; the counts are their lengths
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    saves: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // available -> reserved (trade accepted) -> traded (handover confirmed)
    status: { type: String, enum: ['available', 'reserved', 'traded'], default: 'available' }
}, { timestamps: true });

const Listing = mongoose.model('Listing', listingSchema);

exports.Listing = Listing;

// Get listings with optional category filter, title search and sort
exports.retrieveAll = (filter, sort) => {
    const sortOption = sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };
    return Listing.find(filter).populate('owner', 'name avatarUrl').sort(sortOption);
};

// One page of listings, plus the total (for Discover's "Load more")
exports.retrievePage = async (filter, sort, page, limit) => {
    const sortOption = sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };
    const [items, total] = await Promise.all([
        Listing.find(filter).populate('owner', 'name avatarUrl').sort(sortOption).skip((page - 1) * limit).limit(limit),
        Listing.countDocuments(filter)
    ]);
    return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
};

exports.findById = (id) => Listing.findById(id).populate('owner', 'name wants avatarUrl');

exports.addListing = (data) => Listing.create(data);

exports.editListing = (id, data) => Listing.findByIdAndUpdate(id, data, { returnDocument: 'after' });

exports.deleteListing = (id) => Listing.findByIdAndDelete(id);

exports.setStatus = (ids, status) => Listing.updateMany({ _id: { $in: ids } }, { status });
