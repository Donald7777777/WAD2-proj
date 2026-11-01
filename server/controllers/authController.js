const User = require('../models/User');

// Register a new account and log the user in
exports.register = async (req, res) => {
    try {
        // Tidy the name: no extra spaces ("Daniel   Wong " -> "Daniel Wong")
        const name = String(req.body.name || '').trim().replace(/\s+/g, ' ');
        const email = (req.body.email || '').trim();
        const password = req.body.password || '';

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields are required.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }

        if (name.length < 2 || name.length > 40) {
            return res.status(400).json({ error: 'Your name should be 2 to 40 characters.' });
        }

        const existing = await User.findByEmail(email);
        if (existing) {
            return res.status(400).json({ error: 'An account with this email already exists.' });
        }
        // No two users with the same name, so people can find the right person
        if (await User.findByName(name)) {
            return res.status(400).json({ error: `Someone is already called "${name}". Try adding a middle name or an initial.` });
        }

        const user = await User.createUser(name, email, password);
        req.session.userId = user._id.toString();
        req.session.userName = user.name;

        res.status(201).json({ _id: user._id, name: user.name, email: user.email, wants: user.wants, avatarUrl: user.avatarUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to register.' });
    }
};

exports.login = async (req, res) => {
    try {
        const email = (req.body.email || '').trim();
        const password = req.body.password || '';

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const user = await User.verifyLogin(email, password);
        if (!user) {
            return res.status(401).json({ error: 'Incorrect email or password.' });
        }

        req.session.userId = user._id.toString();
        req.session.userName = user.name;

        res.json({ _id: user._id, name: user.name, email: user.email, wants: user.wants, avatarUrl: user.avatarUrl, blocked: user.blocked || [] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to log in.' });
    }
};

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.json({ message: 'Logged out.' });
    });
};

// Used by the Vue app on load to check if the user is still logged in
exports.getCurrentUser = async (req, res) => {
    if (!req.session.userId) {
        return res.json(null);
    }
    const user = await User.getUserById(req.session.userId);
    res.json(user);
};

// Save the list of things the user wants (used for matching)
exports.updateWants = async (req, res) => {
    try {
        const wants = Array.isArray(req.body.wants) ? req.body.wants : [];
        const cleaned = wants.map(w => String(w).trim()).filter(w => w);

        const user = await User.updateWants(req.session.userId, cleaned);
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save wants.' });
    }
};

// PUT /api/auth/profile  { avatarUrl, avatarPath }: set or remove the profile picture
exports.updateProfile = async (req, res) => {
    try {
        const avatarUrl = typeof req.body.avatarUrl === 'string' ? req.body.avatarUrl : '';
        if (avatarUrl && !/^https?:\/\//.test(avatarUrl)) {
            return res.status(400).json({ error: 'That picture link is not valid.' });
        }
        const before = await User.getUserById(req.session.userId);
        const user = await User.updateProfile(req.session.userId, {
            avatarUrl,
            avatarPath: avatarUrl && typeof req.body.avatarPath === 'string' ? req.body.avatarPath : ''
        });
        // The frontend uses oldAvatarPath to delete the previous picture from Supabase
        res.json({ user, oldAvatarPath: before?.avatarPath !== user.avatarPath ? before?.avatarPath || '' : '' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update your profile.' });
    }
};
