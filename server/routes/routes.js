const express = require('express');
const requireLogin = require('../middleware/requireLogin');
const authController = require('../controllers/authController');
const listingController = require('../controllers/listingController');
const tradeController = require('../controllers/tradeController');
const messageController = require('../controllers/messageController');
const userController = require('../controllers/userController');
const reviewController = require('../controllers/reviewController');
const accountController = require('../controllers/accountController');
const reportController = require('../controllers/reportController');

const router = express.Router();

// Auth
router.post('/api/auth/register', authController.register);
router.post('/api/auth/login', authController.login);
router.post('/api/auth/logout', authController.logout);
router.get('/api/auth/me', authController.getCurrentUser);
router.put('/api/auth/wants', requireLogin, authController.updateWants);
router.put('/api/auth/profile', requireLogin, authController.updateProfile);
// Account: password, forgot/reset password, blocked users, delete account
router.put('/api/auth/password', requireLogin, accountController.changePassword);
router.post('/api/auth/forgot', accountController.forgotPassword);
router.post('/api/auth/reset', accountController.resetPassword);
router.get('/api/auth/blocked', requireLogin, accountController.getBlocked);
router.delete('/api/auth/account', requireLogin, accountController.deleteAccount);

// People: search by name and public profiles (rating, reviews, listings)
router.get('/api/users', userController.searchUsers);
router.get('/api/users/:id', userController.getUserProfile);
router.post('/api/users/:id/block', requireLogin, accountController.toggleBlock);

// Reports (a listing or a user)
router.post('/api/reports', requireLogin, reportController.createReport);

// Listings, search & matching (feature 1)
// /mine, /matches and /saved must come before /:id
router.get('/api/listings', listingController.getAllListings);
router.get('/api/listings/mine', requireLogin, listingController.getMyListings);
router.get('/api/listings/matches', requireLogin, listingController.getMatches);
router.get('/api/listings/saved', requireLogin, listingController.getSavedListings);
router.get('/api/listings/liked', requireLogin, listingController.getLikedListings);
// Who liked / saved my listings
router.get('/api/activity', requireLogin, listingController.getActivity);
router.get('/api/listings/:id/offers', listingController.getListingOffers);
router.get('/api/listings/:id', listingController.getListingById);
router.post('/api/listings', requireLogin, listingController.createListing);
router.put('/api/listings/:id', requireLogin, listingController.updateListing);
router.delete('/api/listings/:id', requireLogin, listingController.deleteListing);
// Likes (heart) and saves (bookmark)
router.post('/api/listings/:id/like', requireLogin, listingController.toggleLike);
router.post('/api/listings/:id/save', requireLogin, listingController.toggleSave);

// Trade proposals (feature 2)
router.get('/api/trades', requireLogin, tradeController.getMyTrades);
router.post('/api/trades', requireLogin, tradeController.createTrade);
router.get('/api/trades/:id', requireLogin, tradeController.getTradeById);
router.post('/api/trades/:id/accept', requireLogin, tradeController.acceptTrade);
router.post('/api/trades/:id/reject', requireLogin, tradeController.rejectTrade);
router.post('/api/trades/:id/counter', requireLogin, tradeController.counterTrade);
router.post('/api/trades/:id/cancel', requireLogin, tradeController.cancelTrade);
router.put('/api/trades/:id/offer', requireLogin, tradeController.editOffer);
// "Could you add more?" requests
router.post('/api/trades/:id/requests', requireLogin, tradeController.requestMore);
router.post('/api/trades/:id/requests/:requestId/respond', requireLogin, tradeController.respondToRequest);

// Chat (feature 3)
router.get('/api/trades/:id/messages', requireLogin, messageController.getMessages);
router.post('/api/trades/:id/messages', requireLogin, messageController.sendMessage);
router.post('/api/trades/:id/read', requireLogin, tradeController.markRead);
router.post('/api/trades/:id/typing', requireLogin, tradeController.typing);
// Notifications: new messages and trade events across all my trades
router.get('/api/notifications/stream', requireLogin, messageController.streamNotifications);
router.get('/api/notifications', requireLogin, messageController.getNotifications);
router.post('/api/notifications/read', requireLogin, messageController.markNotificationsRead);

// Meetup (feature 4)
router.put('/api/trades/:id/meetup', requireLogin, tradeController.setMeetup);

// Inspection checklist (feature 5)
router.put('/api/trades/:id/checklist', requireLogin, tradeController.updateChecklist);
router.post('/api/trades/:id/confirm', requireLogin, tradeController.confirmHandover);

// Reviews after a completed trade
router.get('/api/trades/:id/review', requireLogin, reviewController.getMyReview);
router.post('/api/trades/:id/review', requireLogin, reviewController.createReview);

module.exports = router;
