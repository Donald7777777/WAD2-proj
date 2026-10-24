const express = require('express');
const requireLogin = require('../middleware/requireLogin');
const authController = require('../controllers/authController');
const listingController = require('../controllers/listingController');
const tradeController = require('../controllers/tradeController');
const messageController = require('../controllers/messageController');

const router = express.Router();

// Auth
router.post('/api/auth/register', authController.register);
router.post('/api/auth/login', authController.login);
router.post('/api/auth/logout', authController.logout);
router.get('/api/auth/me', authController.getCurrentUser);
router.put('/api/auth/wants', requireLogin, authController.updateWants);

// Listings, search & matching (feature 1)
// /mine and /matches must come before /:id
router.get('/api/listings', listingController.getAllListings);
router.get('/api/listings/mine', requireLogin, listingController.getMyListings);
router.get('/api/listings/matches', requireLogin, listingController.getMatches);
router.get('/api/listings/:id', listingController.getListingById);
router.post('/api/listings', requireLogin, listingController.createListing);
router.put('/api/listings/:id', requireLogin, listingController.updateListing);
router.delete('/api/listings/:id', requireLogin, listingController.deleteListing);

// Trade proposals (feature 2)
router.get('/api/trades', requireLogin, tradeController.getMyTrades);
router.post('/api/trades', requireLogin, tradeController.createTrade);
router.get('/api/trades/:id', requireLogin, tradeController.getTradeById);
router.post('/api/trades/:id/accept', requireLogin, tradeController.acceptTrade);
router.post('/api/trades/:id/reject', requireLogin, tradeController.rejectTrade);
router.post('/api/trades/:id/counter', requireLogin, tradeController.counterTrade);
router.post('/api/trades/:id/cancel', requireLogin, tradeController.cancelTrade);
// "Could you add more?" requests
router.post('/api/trades/:id/requests', requireLogin, tradeController.requestMore);
router.post('/api/trades/:id/requests/:requestId/respond', requireLogin, tradeController.respondToRequest);

// Chat (feature 3)
router.get('/api/trades/:id/messages', requireLogin, messageController.getMessages);
router.post('/api/trades/:id/messages', requireLogin, messageController.sendMessage);
// Notifications: new messages and trade events across all my trades
router.get('/api/notifications/stream', requireLogin, messageController.streamNotifications);
router.get('/api/notifications', requireLogin, messageController.getNotifications);

// Meetup (feature 4)
router.put('/api/trades/:id/meetup', requireLogin, tradeController.setMeetup);

// Inspection checklist (feature 5)
router.put('/api/trades/:id/checklist', requireLogin, tradeController.updateChecklist);
router.post('/api/trades/:id/confirm', requireLogin, tradeController.confirmHandover);

module.exports = router;
