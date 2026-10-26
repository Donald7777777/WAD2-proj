// Inspection checklist for a trade, built when the trade is accepted.
// Every item in the trade gets its own checks, picked by that item's category
// (a clothing item gets clothing checks, a camera gets camera checks, and so on),
// then a couple of general checks for the whole trade at the end.
const checklistsByCategory = {
    Cameras: [
        'Camera powers on and the shutter fires',
        'Lens is free of scratches, fungus and haze',
        'Battery / film compartment is clean (no corrosion)',
        'Viewfinder or screen is clear'
    ],
    Tech: [
        'Device powers on and charges',
        'Buttons, ports and screen (if it has one) all work',
        'Device is reset and logged out of accounts',
        'Charger and cables are included (if listed)'
    ],
    Music: [
        'Produces sound properly (play or plug it in)',
        'No cracks or warping in the body',
        'All knobs, keys or strings work'
    ],
    Books: [
        'No missing or torn pages',
        'Cover and binding are intact',
        'Title and edition match the listing'
    ],
    Clothing: [
        'Size and fit match the listing',
        'No stains, holes or pilling',
        'Zips, buttons and seams are intact',
        'Clean / washed',
        'Brand tag matches the listing (for branded items)'
    ],
    Outdoors: [
        'Frame / structure has no cracks or rust',
        'Moving parts (wheels, brakes, zips) work',
        'Straps and buckles are intact'
    ],
    Home: [
        'Works as described',
        'No damage beyond what was listed',
        'All parts and accessories are included'
    ],
    Toys: [
        'All pieces are included',
        'No broken or sharp parts',
        'Batteries / electronics work (if any)'
    ],
    Sports: [
        'Check for cracks, tears or other damage',
        'Make sure all parts are included',
        'Check that the item works properly'
    ],
    Perfume: [
        'Check the bottle for cracks or leaks',
        'Check the remaining perfume amount',
        'Check that the cap and spray nozzle work'
    ],
    Cosmetics: [
        'Check the expiry date',
        'Check that the packaging is intact',
        'Check that the product matches the listing'
    ],
    Stationery: [
        'Check that all items are included',
        'Check pens and markers for ink',
        'Check notebooks for missing or damaged pages'
    ],
    Accessories: [
        'Check for scratches or visible damage',
        'Check clasps, zips or fasteners',
        'Check that all parts are included'
    ],
    Other: [
        'Works as described',
        'All parts and accessories are included'
    ]
};

const generalChecks = [
    'Every item matches its listing photos',
    'Every item\'s condition matches its description'
];

// Unknown or missing categories fall back to the "Other" checks
function checksFor(category) {
    return checklistsByCategory[category] || checklistsByCategory.Other;
}

// listings: the trade's items. ownerNames (optional): { [ownerId]: name }, so each group can say whose item it is.
exports.buildChecklist = (listings, ownerNames = {}) => {
    const items = [];
    for (const listing of listings) {
        if (!listing) continue;
        const owner = ownerNames[String(listing.owner?._id || listing.owner)] || '';
        for (const check of checksFor(listing.category)) {
            items.push({
                text: check,
                listing: listing._id,
                item: listing.title,
                category: listing.category || 'Other',
                owner
            });
        }
    }
    for (const check of generalChecks) {
        items.push({ text: check, item: '', category: '', owner: '' });
    }
    return items;
};

exports.checklistsByCategory = checklistsByCategory;
