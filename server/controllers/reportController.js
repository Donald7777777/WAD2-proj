const { Report, REASONS } = require('../models/Report');
const Listing = require('../models/Listing');
const User = require('../models/User');

const isValidId = (id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);

// POST /api/reports  { type: 'listing' | 'user', id, reason, details }
exports.createReport = async (req, res) => {
    try {
        const me = req.session.userId;
        const { type, id, reason } = req.body;
        const details = String(req.body.details || '').trim().slice(0, 500);

        if (!['listing', 'user'].includes(type) || !isValidId(id)) {
            return res.status(400).json({ error: 'What are you reporting?' });
        }
        if (!REASONS.includes(reason)) {
            return res.status(400).json({ error: 'Pick a reason.' });
        }
        if (reason === 'other' && !details) {
            return res.status(400).json({ error: 'Tell us a little about what happened.' });
        }

        // The thing must exist, and you can't report yourself or your own listing
        if (type === 'listing') {
            const listing = await Listing.Listing.findById(id).select('owner');
            if (!listing) return res.status(404).json({ error: 'Listing not found.' });
            if (listing.owner.toString() === me) return res.status(400).json({ error: "You can't report your own listing." });
        } else {
            if (id === me) return res.status(400).json({ error: "You can't report yourself." });
            if (!(await User.User.exists({ _id: id }))) return res.status(404).json({ error: 'User not found.' });
        }

        await Report.findOneAndUpdate(
            { reporter: me, targetType: type, target: id, status: 'open' },
            { reason, details },
            { upsert: true, returnDocument: 'after' }
        );
        res.status(201).json({ message: 'Thanks. Our team will take a look.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to send the report.' });
    }
};
