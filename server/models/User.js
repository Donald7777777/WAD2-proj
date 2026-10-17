const mongoose = require('mongoose');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // Free-text keywords or categories the user wants, e.g. ["Cameras", "film lens"]
    wants: { type: [String], default: [] }
}, { timestamps: true });

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

exports.createUser = async (name, email, password) => {
    return User.create({ name, email, passwordHash: hashPassword(password) });
};

exports.findByEmail = (email) => User.findOne({ email: email.toLowerCase() });

exports.verifyLogin = async (email, password) => {
    const user = await exports.findByEmail(email);
    if (!user || !checkPassword(password, user.passwordHash)) {
        return null;
    }
    return user;
};

exports.getUserById = (id) => User.findById(id).select('-passwordHash');

exports.updateWants = (id, wants) =>
    User.findByIdAndUpdate(id, { wants }, { returnDocument: 'after' }).select('-passwordHash');
