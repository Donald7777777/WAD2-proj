// Simple scoring for "Smart matching".
// The deck plans an LLM to turn free-text wants into categories; this rule-based
// version is the fallback and works without any API key.

function normalise(text) {
    return (text || '').toLowerCase();
}

// Does one "want" (category or keyword) match a listing?
function wantMatchesListing(want, listing) {
    const w = normalise(want);
    if (!w) return false;
    return normalise(listing.category) === w ||
        normalise(listing.title).includes(w) ||
        normalise(listing.description).includes(w);
}

// Score how well `listing` fits what `user` wants (0-100)
function scoreListing(user, listing, myListings) {
    let score = 0;

    for (const want of user.wants) {
        if (normalise(listing.category) === normalise(want)) {
            score += 50;
        } else if (wantMatchesListing(want, listing)) {
            score += 15;
        }
    }

    // Mutual match: the listing's owner wants something I have listed,
    // either in their profile wants or the listing's "looking for" text (comma separated)
    const lookingForTerms = (listing.lookingFor || '').split(',').map(t => t.trim());
    const ownerWants = [...(listing.owner.wants || []), ...lookingForTerms];
    const mutual = myListings.some(mine =>
        ownerWants.some(want => wantMatchesListing(want, mine))
    );
    if (mutual) {
        score += 30;
    }

    return { score: Math.min(score, 100), mutual };
}

// Returns listings with a score > 0, best first
exports.rankMatches = (user, listings, myListings) => {
    return listings
        .map(listing => {
            const { score, mutual } = scoreListing(user, listing, myListings);
            return { listing, score, mutual };
        })
        .filter(m => m.score > 0)
        .sort((a, b) => b.score - a.score);
};
