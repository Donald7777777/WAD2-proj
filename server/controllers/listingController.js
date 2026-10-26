const Listing = require('../models/Listing');
const User = require('../models/User');
const { Trade } = require('../models/Trade');
const { rankMatches } = require('../utils/matching');
const Reaction = require('../models/Reaction');

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
        // Reserved items (in an accepted trade) still show, so others can make a competing offer.
        // Only traded items are hidden.
        const filter = { status: { $in: ['available', 'reserved'] } };

        if (category && category !== 'All') {
            filter.category = category;
        }

        // Case-insensitive title search; escape regex special characters first
        if (search) {
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.title = { $regex: escapedSearch, $options: 'i' };
        }

        // People you've blocked (or who blocked you) are hidden
        const hidden = await User.blockedIds(req.session.userId);
        if (owner) {
            if (!isValidId(owner)) {
                return res.status(400).json({ error: 'Invalid owner id.' });
            }
            if (hidden.includes(owner)) return res.json(req.query.page ? { items: [], total: 0, page: 1, pages: 1 } : []);
            filter.owner = owner;
        } else if (req.session.userId) {
            // Don't show users their own items on the discover page
            filter.owner = { $nin: [req.session.userId, ...hidden] };
        }

        // ?page=2&limit=24 -> { items, total, page, pages }; without page, the whole list (as before)
        if (req.query.page) {
            const page = Math.max(1, parseInt(first(req.query.page), 10) || 1);
            const limit = Math.min(48, Math.max(1, parseInt(first(req.query.limit), 10) || 24));
            return res.json(await Listing.retrievePage(filter, sort, page, limit));
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

// GET /api/listings/:id/offers
// Every live offer for this listing (open or accepted), so anyone can see the competition.
// "Offerer" is the person trading with the listing's owner; "items" is what they put up.
exports.getListingOffers = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(404).json({ error: 'Listing not found.' });
        }
        const listing = await Listing.Listing.findById(req.params.id).select('owner');
        if (!listing) {
            return res.status(404).json({ error: 'Listing not found.' });
        }
        const owner = listing.owner.toString();
        const me = req.session?.userId;
        const trades = await Trade.find({
            status: { $in: ['pending', 'countered', 'accepted'] },
            $or: [{ requestedListings: listing._id }, { offeredListings: listing._id }]
        })
            .populate('proposer', 'name avatarUrl')
            .populate('receiver', 'name avatarUrl')
            .populate('requestedListings', 'title imageUrl images condition owner status')
            .populate('offeredListings', 'title imageUrl images condition owner status')
            .sort({ createdAt: 1 });

        const offers = trades
            .filter((t) => t.proposer && t.receiver)
            .map((t) => {
                const offerer = t.proposer._id.toString() === owner ? t.receiver : t.proposer;
                const items = [...t.requestedListings, ...t.offeredListings]
                    .filter((l) => l && l.owner.toString() === offerer._id.toString());
                const mine = Boolean(me) && [t.proposer._id.toString(), t.receiver._id.toString()].includes(me);
                return {
                    _id: t._id,
                    status: t.status,
                    createdAt: t.createdAt,
                    updatedAt: t.updatedAt,
                    offerer: { _id: offerer._id, name: offerer.name, avatarUrl: offerer.avatarUrl || '' },
                    items: items.map((l) => ({ _id: l._id, title: l.title, imageUrl: l.imageUrl, condition: l.condition })),
                    // Only the two traders can open the trade itself
                    tradeId: mine ? t._id : null,
                    mine
                };
            })
            // The accepted one first, then the rest oldest first
            .sort((a, b) => (b.status === 'accepted') - (a.status === 'accepted'));
        res.json(offers);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load offers.' });
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
        // Blocked either way: the page still opens, but you can't make an offer
        const hidden = listing.owner ? await User.blockedIds(req.session?.userId) : [];
        const data = typeof listing.toJSON === 'function' ? listing.toJSON() : listing;
        res.json({ ...data, blocked: hidden.includes(listing.owner?._id?.toString()) });
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
            .find({
                status: { $in: ['available', 'reserved'] },
                owner: { $nin: [req.session.userId, ...(await User.blockedIds(req.session.userId))] }
            })
            .populate('owner', 'name wants avatarUrl');
        const mine = await Listing.Listing.find({ owner: req.session.userId, status: 'available' });

        res.json(rankMatches(user, others, mine));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load matches.' });
    }
};

// ---------- Likes and saves ----------
// POST /api/listings/:id/like  and  POST /api/listings/:id/save
// Each call switches it on or off for the logged-in user and returns the new totals.
function toggle(field) {
    return async (req, res) => {
        try {
            const me = req.session.userId;
            if (!isValidId(req.params.id)) {
                return res.status(404).json({ error: 'Listing not found.' });
            }
            const listing = await Listing.Listing.findById(req.params.id).select('owner likes saves');
            if (!listing) {
                return res.status(404).json({ error: 'Listing not found.' });
            }
            if (listing.owner.toString() === me) {
                return res.status(400).json({ error: `You can't ${field === 'likes' ? 'like' : 'save'} your own listing.` });
            }
            const already = (listing[field] || []).some((id) => id.toString() === me);
            const updated = await Listing.Listing.findByIdAndUpdate(
                req.params.id,
                already ? { $pull: { [field]: me } } : { $addToSet: { [field]: me } },
                { returnDocument: 'after' }
            ).select('likes saves');
            // Keep a timestamped record for the owner's activity page and notification
            const record = { user: me, listing: listing._id, owner: listing.owner, kind: field === 'likes' ? 'like' : 'save' };
            if (already) await Reaction.remove(record);
            else await Reaction.add(record);

            const has = (list) => (list || []).some((id) => id.toString() === me);
            res.json({
                likeCount: (updated.likes || []).length,
                saveCount: (updated.saves || []).length,
                liked: has(updated.likes),
                saved: has(updated.saves)
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Something went wrong. Please try again.' });
        }
    };
}

exports.toggleLike = toggle('likes');
exports.toggleSave = toggle('saves');

// GET /api/listings/saved: everything the logged-in user has saved, newest first
exports.getSavedListings = async (req, res) => {
    try {
        const listings = await Listing.Listing.find({ saves: req.session.userId })
            .populate('owner', 'name avatarUrl')
            .sort({ updatedAt: -1 });
        res.json(listings);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load your saved items.' });
    }
};

// GET /api/listings/liked: everything the logged-in user has liked, newest first
exports.getLikedListings = async (req, res) => {
    try {
        const listings = await Listing.Listing.find({ likes: req.session.userId })
            .populate('owner', 'name avatarUrl')
            .sort({ updatedAt: -1 });
        res.json(listings);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load your liked items.' });
    }
};

// GET /api/activity?kind=like|save&listing=<id>
// Who liked or saved my listings, newest first (like Instagram's activity)
exports.getActivity = async (req, res) => {
    try {
        const filter = { owner: req.session.userId };
        if (['like', 'save'].includes(req.query.kind)) filter.kind = req.query.kind;
        if (isValidId(req.query.listing)) filter.listing = req.query.listing;
        const rows = await Reaction.Reaction.find(filter)
            .populate('user', 'name avatarUrl')
            .populate('listing', 'title imageUrl status')
            .sort({ createdAt: -1 })
            .limit(100);
        // Skip likes on listings or by users that no longer exist
        res.json(rows.filter((r) => r.user && r.listing));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load your activity.' });
    }
};
