const Listing = require('../models/Listing');
const User = require('../models/User');
const { Trade } = require('../models/Trade');
const { rankMatches } = require('../utils/matching');

const CATEGORIES = ['Cameras', 'Tech', 'Music', 'Books', 'Clothing', 'Outdoors', 'Home', 'Toys', 'Other'];
const CONDITIONS = ['Like new', 'Excellent', 'Good', 'Fair'];

function validateListing(body) {
    const { title, description, category, condition } = body;
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
        const { category, search, sort, owner } = req.query;
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
            title: req.body.title.trim(),
            description: req.body.description.trim(),
            category: req.body.category,
            condition: req.body.condition,
            lookingFor: (req.body.lookingFor || '').trim(),
            imagePath: req.body.imagePath || '',
            imageUrl: req.body.imageUrl || ''
        });
        res.status(201).json(listing);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create listing.' });
    }
};

exports.updateListing = async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id);
        if (!listing) {
            return res.status(404).json({ error: 'Listing not found.' });
        }

        // Only the owner can edit, and only while nothing is agreed on it
        if (listing.owner._id.toString() !== req.session.userId) {
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
            title: req.body.title.trim(),
            description: req.body.description.trim(),
            category: req.body.category,
            condition: req.body.condition,
            lookingFor: (req.body.lookingFor || '').trim(),
            imagePath: req.body.imagePath ?? listing.imagePath,
            imageUrl: req.body.imageUrl ?? listing.imageUrl
        });
        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update listing.' });
    }
};

exports.deleteListing = async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id);
        if (!listing) {
            return res.status(404).json({ error: 'Listing not found.' });
        }
        if (listing.owner._id.toString() !== req.session.userId) {
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
        // The frontend uses imagePath to remove the photo from Supabase
        res.json({ message: 'Listing deleted.', imagePath: listing.imagePath });
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
