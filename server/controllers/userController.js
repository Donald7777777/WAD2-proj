const User = require('../models/User');
const Listing = require('../models/Listing');
const { Trade } = require('../models/Trade');
const { Review, ratingsFor } = require('../models/Review');

const isValidId = (id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);

// GET /api/users?search=dan: find people by name (case-insensitive, anywhere in the name)
exports.searchUsers = async (req, res) => {
    try {
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        if (!search) return res.json([]);
        const escaped = search.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Deleted accounts, and people who blocked you, don't show up
        const blockedMe = req.session?.userId
            ? (await User.User.find({ blocked: req.session.userId }).select('_id')).map((u) => u._id)
            : [];
        const users = await User.User.find({ name: { $regex: escaped, $options: 'i' }, deleted: { $ne: true }, _id: { $nin: blockedMe } })
            .select('name avatarUrl createdAt')
            .sort({ name: 1 })
            .limit(12);
        const ratings = await ratingsFor(users.map((u) => u._id));
        const listingCounts = await Listing.Listing.aggregate([
            { $match: { owner: { $in: users.map((u) => u._id) }, status: { $in: ['available', 'reserved'] } } },
            { $group: { _id: '$owner', count: { $sum: 1 } } }
        ]);
        const counts = new Map(listingCounts.map((r) => [r._id.toString(), r.count]));
        res.json(users.map((u) => ({
            _id: u._id,
            name: u.name,
            avatarUrl: u.avatarUrl,
            rating: ratings.get(u._id.toString()) || { average: 0, count: 0 },
            listingCount: counts.get(u._id.toString()) || 0
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to search for people.' });
    }
};

// GET /api/users/:id: someone's public profile: picture, rating, reviews and available listings
exports.getUserProfile = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) return res.status(404).json({ error: 'User not found.' });
        const user = await User.User.findById(req.params.id).select('name avatarUrl createdAt blocked deleted');
        if (!user) return res.status(404).json({ error: 'User not found.' });
        const me = req.session?.userId;
        // Someone who blocked you looks like they don't exist
        if (me && user.blocked.some((id) => id.toString() === me)) return res.status(404).json({ error: 'User not found.' });
        const blockedByMe = me ? (await User.blockedIds(me)).includes(user._id.toString()) : false;

        const [ratings, reviews, listings, tradesCompleted] = await Promise.all([
            ratingsFor([user._id]),
            Review.find({ to: user._id }).populate('from', 'name avatarUrl').sort({ createdAt: -1 }).limit(50),
            Listing.Listing.find({ owner: user._id, status: { $in: ['available', 'reserved'] } }).populate('owner', 'name avatarUrl').sort({ createdAt: -1 }),
            Trade.countDocuments({ status: 'completed', $or: [{ proposer: user._id }, { receiver: user._id }] })
        ]);
        res.json({
            _id: user._id,
            name: user.name,
            avatarUrl: user.avatarUrl,
            memberSince: user.createdAt,
            rating: ratings.get(user._id.toString()) || { average: 0, count: 0 },
            reviews,
            listings: blockedByMe ? [] : listings,
            tradesCompleted,
            blockedByMe,
            deleted: user.deleted
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load this profile.' });
    }
};
