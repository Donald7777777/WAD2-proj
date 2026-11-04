const mongoose = require('mongoose');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // Free-text keywords or categories the user wants, e.g. ["Cameras", "film lens"]
    wants: { type: [String], default: [] },
    // Profile picture, stored in Supabase Storage (path is kept so the old one can be deleted)
    avatarUrl: { type: String, default: '' },
    avatarPath: { type: String, default: '' },
    // Notifications: when you last checked in (anything newer is "missed") and last opened the bell
    notifSeenAt: { type: Date },
    notifReadAt: { type: Date },
    // People you've blocked: you don't see each other's listings and can't trade or message
    blocked: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Forgot password: a one-time reset code (only its hash is stored) and when it expires
    resetTokenHash: { type: String, default: '' },
    resetTokenExpires: { type: Date },
    // Deleted accounts are kept as "Deleted user" so old trades and reviews still make sense
    deleted: { type: Boolean, default: false }
}, { timestamps: true });

// Never send these to the browser
const PRIVATE = '-passwordHash -resetTokenHash -resetTokenExpires';

const User = mongoose.model('User', userSchema);

// Passwords are hashed with Node's built-in scrypt, stored as "salt:hash"
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

function checkPassword(password, stored) {
    const [salt, hash] = stored.split(':');
    const attempt = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(attempt, Buffer.from(hash, 'hex'));
}

exports.User = User;
exports.hashPassword = hashPassword;
exports.checkPassword = checkPassword;

exports.createUser = async (name, email, password) => {
    return User.create({ name, email, passwordHash: hashPassword(password) });
};

exports.findByEmail = (email) => User.findOne({ email: email.toLowerCase() });

// Names are unique, ignoring capitals ("daniel wong" = "Daniel Wong")
exports.findByName = (name) => User.findOne({ name }).collation({ locale: 'en', strength: 2 });

exports.updateProfile = (id, data) =>
    User.findByIdAndUpdate(id, data, { returnDocument: 'after' }).select(PRIVATE);

exports.verifyLogin = async (email, password) => {
    const user = await exports.findByEmail(email);
    if (!user || user.deleted || !checkPassword(password, user.passwordHash)) {
        return null;
    }
    return user;
};

exports.getUserById = (id) => User.findById(id).select(PRIVATE);

// Everyone I shouldn't see or deal with: people I blocked, and people who blocked me
exports.blockedIds = async (me) => {
    if (!me) return [];
    const [mine, theirs] = await Promise.all([
        User.findById(me).select('blocked'),
        User.find({ blocked: me }).select('_id')
    ]);
    return [...(mine?.blocked || []), ...theirs.map((u) => u._id)].map((id) => id.toString());
};
exports.isBlockedBetween = async (a, b) => (await exports.blockedIds(a)).includes(b.toString());

exports.updateWants = (id, wants) =>
    User.findByIdAndUpdate(id, { wants }, { returnDocument: 'after' }).select(PRIVATE);
