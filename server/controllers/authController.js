const User = require('../models/User');

// Register a new account and log the user in
exports.register = async (req, res) => {
    try {
        const name = (req.body.name || '').trim();
        const email = (req.body.email || '').trim();
        const password = req.body.password || '';

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields are required.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }

        const existing = await User.findByEmail(email);
        if (existing) {
            return res.status(400).json({ error: 'An account with this email already exists.' });
        }

        const user = await User.createUser(name, email, password);
        req.session.userId = user._id.toString();
        req.session.userName = user.name;

        res.status(201).json({ _id: user._id, name: user.name, email: user.email, wants: user.wants });
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

        res.json({ _id: user._id, name: user.name, email: user.email, wants: user.wants });
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
