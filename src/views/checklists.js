// Inspection checklist items generated per item category.
// Every trade also gets the general checks at the end.
const checklistsByCategory = {
    Cameras: [
        'Shutter fires at different speeds',
        'Lens glass is free of fungus, haze and scratches',
        'Battery compartment is clean (no corrosion)',
        'Viewfinder is clear'
    ],
    Tech: [
        'Device powers on and charges',
        'All buttons and ports work',
        'Screen has no dead pixels or cracks',
        'Device is reset / logged out of accounts'
    ],
    Music: [
        'Instrument / device produces sound properly',
        'No cracks or warping in the body',
        'All knobs, keys or strings work'
    ],
    Books: [
        'No missing or torn pages',
        'Cover and binding are intact',
        'Edition matches the listing'
    ],
    Clothing: [
        'Size matches the listing',
        'No stains, holes or broken zips',
        'Item has been washed'
    ],
    Outdoors: [
        'Frame / structure has no cracks or rust',
        'Moving parts (wheels, brakes, zips) work',
        'Straps and buckles are intact'
    ],
    Home: [
        'Item works as described',
        'No damage beyond what was listed',
        'All parts and accessories are included'
    ],
    Toys: [
        'All pieces are included',
        'No broken or sharp parts',
        'Batteries / electronics work (if any)'
    ]
};

const generalChecks = [
    'Item matches the photos in the listing',
    'Item condition matches the description'
];

// Build a checklist from the categories of all items in the trade
exports.buildChecklist = (listings) => {
    const items = [];
    const seenCategories = new Set();

    for (const listing of listings) {
        if (seenCategories.has(listing.category)) continue;
        seenCategories.add(listing.category);

        const checks = checklistsByCategory[listing.category] || [];
        for (const check of checks) {
            items.push({ text: `${listing.category}: ${check}` });
        }
    }

    for (const check of generalChecks) {
        items.push({ text: check });
    }
    return items;
};
