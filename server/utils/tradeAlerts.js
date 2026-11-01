const { Trade } = require('../models/Trade');
const Message = require('../models/Message');

// Telling the *other* people around an item that something changed.
//
// Several trades can share an item: everyone bidding for Hannah's Polaroid has their own trade
// with Hannah. When one of those trades changes (a bid is improved, Hannah accepts someone, the
// deal falls through...), the people in the other trades should hear about it too.
//
// alertOthers posts a note into every other live trade that shares one of `listings`, addressed
// to the one trader there who is neither the item's owner nor the person who caused the change.

const LIVE = ['pending', 'countered', 'accepted'];
const idOf = (value) => (value && value._id ? value._id : value).toString();
const titles = (listings) => listings.map((l) => l.title).join(', ');
const isAre = (listings) => (listings.length === 1 ? 'is' : 'are');

/**
 * @param listings       Listing documents (with title and owner) that changed
 * @param exceptTradeId  the trade that caused it (skipped)
 * @param actorId        who caused it (never alerted)
 * @param kind           notification kind, e.g. 'rivalChanged'
 * @param text           (shared listings) => message text
 * @param statuses       which other trades to tell (default: every live one)
 * @param skipTradeIds   trades already told something more specific
 * @returns how many people were told
 */
async function alertOthers({ listings, exceptTradeId, actorId, kind, text, statuses = LIVE, skipTradeIds = [] }) {
    const items = listings.filter((l) => l && l.title);
    if (!items.length) return 0;
    const ids = items.map((l) => idOf(l));
    const others = await Trade.find({
        _id: { $nin: [exceptTradeId, ...skipTradeIds] },
        status: { $in: statuses },
        $or: [{ requestedListings: { $in: ids } }, { offeredListings: { $in: ids } }]
    });
    let told = 0;
    for (const other of others) {
        const inOther = new Set([...other.requestedListings, ...other.offeredListings].map(idOf));
        const shared = items.filter((l) => inOther.has(idOf(l)));
        const owners = new Set(shared.map((l) => idOf(l.owner)));
        const to = [idOf(other.proposer), idOf(other.receiver)]
            .find((u) => u !== String(actorId) && !owners.has(u));
        if (!to) continue;
        await Message.addSystemMessage(other._id, text(shared), {
            kind, for: to, by: actorId || undefined, listing: shared[0]._id
        });
        told++;
    }
    return told;
}

module.exports = { alertOthers, titles, isAre, idOf, LIVE };
