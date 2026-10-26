const crypto = require('crypto');
const User = require('../models/User');
const Listing = require('../models/Listing');
const Trade = require('../models/Trade');
const Message = require('../models/Message');
const { Reaction } = require('../models/Reaction');

const isValidId = (id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
const RESET_MINUTES = 30;
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// ---------- Password ----------

// PUT /api/auth/password  { currentPassword, newPassword }
exports.changePassword = async (req, res) => {
    try {
        const current = String(req.body.currentPassword || '');
        const next = String(req.body.newPassword || '');
        if (next.length < 6) {
            return res.status(400).json({ error: 'Your new password must be at least 6 characters.' });
        }
        const user = await User.User.findById(req.session.userId);
        if (!user || !User.checkPassword(current, user.passwordHash)) {
            return res.status(400).json({ error: 'Your current password is not right.' });
        }
        if (current === next) {
            return res.status(400).json({ error: 'Pick a password different from your current one.' });
        }
        user.passwordHash = User.hashPassword(next);
        await user.save();
        res.json({ message: 'Password changed.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to change your password.' });
    }
};

// POST /api/auth/forgot  { email }
// Makes a one-time reset link that works for 30 minutes. TradeHappy has no email service yet,
// so the link is printed in the server terminal, and (outside production) sent back to the
// page so the demo works. The reply is the same whether or not the email exists.
exports.forgotPassword = async (req, res) => {
    try {
        const email = String(req.body.email || '').trim();
        const reply = { message: 'If that email has an account, a reset link has been sent.' };
        if (!email) return res.status(400).json({ error: 'Enter your email.' });

        const user = await User.findByEmail(email);
        if (!user || user.deleted) return res.json(reply);

        const token = crypto.randomBytes(24).toString('hex');
        user.resetTokenHash = hashToken(token);
        user.resetTokenExpires = new Date(Date.now() + RESET_MINUTES * 60 * 1000);
        await user.save();

        const link = `/reset-password?token=${token}`;
        console.log(`Password reset link for ${user.email}: http://localhost:5173${link}`);
        if (process.env.NODE_ENV !== 'production') reply.devResetLink = link;
        res.json(reply);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to start the password reset.' });
    }
};

// POST /api/auth/reset  { token, password }
exports.resetPassword = async (req, res) => {
    try {
        const token = String(req.body.token || '');
        const password = String(req.body.password || '');
        if (password.length < 6) {
            return res.status(400).json({ error: 'Your new password must be at least 6 characters.' });
        }
        const user = token && await User.User.findOne({
            resetTokenHash: hashToken(token),
            resetTokenExpires: { $gt: new Date() }
        });
        if (!user) {
            return res.status(400).json({ error: 'This reset link has expired or was already used. Ask for a new one.' });
        }
        user.passwordHash = User.hashPassword(password);
        user.resetTokenHash = '';
        user.resetTokenExpires = undefined;
        await user.save();
        res.json({ message: 'Password reset. You can log in now.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to reset your password.' });
    }
};

// ---------- Blocking ----------

// GET /api/auth/blocked: the people I've blocked
exports.getBlocked = async (req, res) => {
    try {
        const me = await User.User.findById(req.session.userId).populate('blocked', 'name avatarUrl');
        res.json((me?.blocked || []).filter(Boolean));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load blocked users.' });
    }
};

// POST /api/users/:id/block: block or unblock someone (switches each time)
exports.toggleBlock = async (req, res) => {
    try {
        const me = req.session.userId;
        const id = req.params.id;
        if (!isValidId(id) || id === me) return res.status(400).json({ error: "You can't block that user." });
        if (!(await User.User.exists({ _id: id }))) return res.status(404).json({ error: 'User not found.' });

        const user = await User.User.findById(me).select('blocked');
        const already = user.blocked.some((b) => b.toString() === id);
        await User.User.updateOne({ _id: me }, already ? { $pull: { blocked: id } } : { $addToSet: { blocked: id } });

        // Blocking ends any open proposals between you (accepted trades are left for you to cancel)
        if (!already) {
            const open = await Trade.Trade.find({
                status: { $in: ['pending', 'countered'] },
                $or: [{ proposer: me, receiver: id }, { proposer: id, receiver: me }]
            });
            for (const trade of open) {
                trade.status = 'cancelled';
                trade.turn = null;
                await trade.save();
                await Message.addSystemMessage(trade._id, 'This proposal was closed.');
            }
        }
        res.json({ blocked: !already });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update blocking.' });
    }
};

// ---------- Delete account ----------

// DELETE /api/auth/account  { password }
// Live trades are cancelled, non-traded listings are removed, and the account becomes
// "Deleted user" (so completed trades and reviews still read properly). Sends back the
// Supabase image paths so the browser can delete the photos.
exports.deleteAccount = async (req, res) => {
    try {
        const me = req.session.userId;
        const user = await User.User.findById(me);
        if (!user || !User.checkPassword(String(req.body.password || ''), user.passwordHash)) {
            return res.status(400).json({ error: 'That password is not right.' });
        }

        // Cancel live trades and free the other person's items
        const live = await Trade.Trade.find({
            status: { $in: ['pending', 'countered', 'accepted'] },
            $or: [{ proposer: me }, { receiver: me }]
        });
        for (const trade of live) {
            if (trade.status === 'accepted') {
                await Listing.setStatus([...trade.requestedListings, ...trade.offeredListings], 'available');
            }
            trade.status = 'cancelled';
            trade.turn = null;
            await trade.save();
            await Message.addSystemMessage(trade._id, `${user.name} cancelled the trade because they deleted their account.`);
        }

        // Remove listings that weren't traded, plus their likes and saves
        const listings = await Listing.Listing.find({ owner: me, status: { $ne: 'traded' } });
        const imagePaths = listings.flatMap((l) => [...(l.images || []).map((i) => i.path), l.imagePath]).filter(Boolean);
        await Listing.Listing.deleteMany({ _id: { $in: listings.map((l) => l._id) } });
        await Reaction.deleteMany({ $or: [{ user: me }, { listing: { $in: listings.map((l) => l._id) } }] });
        await Listing.Listing.updateMany({}, { $pull: { likes: me, saves: me } });
        if (user.avatarPath) imagePaths.push(user.avatarPath);
        const uniquePaths = [...new Set(imagePaths)];

        Object.assign(user, {
            name: 'Deleted user',
            email: `deleted-${me}@deleted.tradehappy`,
            passwordHash: User.hashPassword(crypto.randomBytes(16).toString('hex')),
            wants: [],
            avatarUrl: '',
            avatarPath: '',
            blocked: [],
            resetTokenHash: '',
            deleted: true
        });
        await user.save();

        req.session.destroy(() => res.json({ message: 'Your account has been deleted.', imagePaths: uniquePaths }));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete your account.' });
    }
};
