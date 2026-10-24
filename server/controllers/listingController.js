const Listing = require('../models/Listing');
const User = require('../models/User');
const { Trade } = require('../models/Trade');
const { rankMatches } = require('../utils/matching');

const MAX_IMAGES = 6;

// Photos from the request: an `images` array of { path, url } (first = cover),
// or the older single imagePath/imageUrl. Returns null if neither was sent.
function readImages(body) {
    if (Array.isArray(body.images)) {
        return body.images
            .filter((img) => img && typeof img.url === 'string' && /^https?:\/\//.test(img.url))
            .slice(0, MAX_IMAGES)
            .map((img) => ({ path: typeof img.path === 'string' ? img.path : '', url: img.url }));
    }
    if (typeof body.imageUrl === 'string' && body.imageUrl) {
        return [{ path: typeof body.imagePath === 'string' ? body.imagePath : '', url: body.imageUrl }];
    }
    return null;
}

// imagePath/imageUrl always mirror the cover photo
function withCover(images) {
    return { images, imagePath: images[0]?.path || '', imageUrl: images[0]?.url || '' };
}

// All photos of a listing, including ones saved before multiple photos existed
function allImages(listing) {
    if (listing.images?.length) return listing.images;
    return listing.imageUrl ? [{ path: listing.imagePath, url: listing.imageUrl }] : [];
}

const CATEGORIES = ['Cameras', 'Tech', 'Music', 'Books', 'Clothing', 'Outdoors', 'Home', 'Toys', 'Other'];
const CONDITIONS = ['Like new', 'Excellent', 'Good', 'Fair'];

// MongoDB ids are 24 hex characters; anything else can't match a listing
function isValidId(id) {
    return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
}

// Treat missing or non-text values as empty, and ignore surrounding spaces
function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function validateListing(body) {
    const title = text(body.title);
    const description = text(body.description);
    const { category, condition } = body;
    if (!title || !description || !category || !condition) {
        return 'Title, description, category and condition are required.';
    }
    if (!CATEGORIES.includes(category)) {
        return 'Invalid category.';
    }
    if (!CONDITIONS.includes(condition)) {
        return 'Invalid condition.';
    }
    return null;
}

// Get available listings with optional filtering, searching and sorting
// e.g. /api/listings?category=Tech&search=keyboard&sort=newest&owner=<id>
exports.getAllListings = async (req, res) => {
    try {
        // A repeated query param (?search=a&search=b) arrives as an array; use the first value
        const first = (value) => (Array.isArray(value) ? value[0] : value);
        const category = first(req.query.category);
        const search = text(first(req.query.search));
        const sort = first(req.query.sort);
        const owner = first(req.query.owner);
        const filter = { status: 'available' };

        if (category && category !== 'All') {
            filter.category = category;
        }

        // Case-insensitive title search; escape regex special characters first
        if (search) {
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.title = { $regex: escapedSearch, $options: 'i' };
        }

        if (owner) {
            if (!isValidId(owner)) {
                return res.status(400).json({ error: 'Invalid owner id.' });
            }
            filter.owner = owner;
        } else if (req.session.userId) {
            // Don't show users their own items on the discover page
            filter.owner = { $ne: req.session.userId };
        }

        const listings = await Listing.retrieveAll(filter, sort);
        res.json(listings);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load listings.' });
    }
};

// All listings (any status) owned by the logged-in user
exports.getMyListings = async (req, res) => {
    try {
        const listings = await Listing.retrieveAll({ owner: req.session.userId }, 'newest');
        res.json(listings);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load your listings.' });
    }
};

exports.getListingById = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(404).json({ error: 'Listing not found.' });
        }
        const listing = await Listing.findById(req.params.id);
        if (!listing) {
            return res.status(404).json({ error: 'Listing not found.' });
        }
        res.json(listing);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load listing.' });
    }
};

exports.createListing = async (req, res) => {
    try {
        const error = validateListing(req.body);
        if (error) {
            return res.status(400).json({ error });
        }

        const listing = await Listing.addListing({
            owner: req.session.userId,
            title: text(req.body.title),
            description: text(req.body.description),
            category: req.body.category,
            condition: req.body.condition,
            lookingFor: text(req.body.lookingFor),
            ...withCover(readImages(req.body) || [])
        });
        res.status(201).json(listing);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create listing.' });
    }
};

exports.updateListing = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(404).json({ error: 'Listing not found.' });
        }
        const listing = await Listing.findById(req.params.id);
        if (!listing) {
            return res.status(404).json({ error: 'Listing not found.' });
        }

        // Only the owner can edit, and only while nothing is agreed on it
        if (String(listing.owner?._id) !== req.session.userId) {
            return res.status(403).json({ error: 'You are not allowed to edit this listing.' });
        }
        if (listing.status !== 'available') {
            return res.status(400).json({ error: 'This listing is part of a trade and can no longer be edited.' });
        }

        const error = validateListing(req.body);
        if (error) {
            return res.status(400).json({ error });
        }

        const updated = await Listing.editListing(req.params.id, {
            title: text(req.body.title),
            description: text(req.body.description),
            category: req.body.category,
            condition: req.body.condition,
            lookingFor: text(req.body.lookingFor),
            // Photos not sent = keep the current ones
            ...withCover(readImages(req.body) ?? allImages(listing))
        });
        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update listing.' });
    }
};

exports.deleteListing = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(404).json({ error: 'Listing not found.' });
        }
        const listing = await Listing.findById(req.params.id);
        if (!listing) {
            return res.status(404).json({ error: 'Listing not found.' });
        }
        if (String(listing.owner?._id) !== req.session.userId) {
            return res.status(403).json({ error: 'You are not allowed to delete this listing.' });
        }
        if (listing.status === 'reserved') {
            return res.status(400).json({ error: 'Cancel the accepted trade before deleting this listing.' });
        }
        const openTrade = await Trade.exists({
            status: { $in: ['pending', 'countered'] },
            $or: [{ requestedListings: listing._id }, { offeredListings: listing._id }]
        });
        if (openTrade) {
            return res.status(400).json({ error: 'This item is in an open proposal. Reject or withdraw it first.' });
        }

        await Listing.deleteListing(req.params.id);
        // The frontend uses these paths to remove the photos from Supabase
        const imagePaths = allImages(listing).map((img) => img.path).filter(Boolean);
        res.json({ message: 'Listing deleted.', imagePath: listing.imagePath, imagePaths });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete listing.' });
    }
};

// Ranked matches for the logged-in user, based on their wants
exports.getMatches = async (req, res) => {
    try {
        const user = await User.getUserById(req.session.userId);
        const others = await Listing.Listing
            .find({ status: 'available', owner: { $ne: req.session.userId } })
            .populate('owner', 'name wants');
        const mine = await Listing.Listing.find({ owner: req.session.userId, status: 'available' });

        res.json(rankMatches(user, others, mine));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load matches.' });
    }
};
