// Fills the database with 8 demo users and 50 listings for testing.
// Run from the server folder:
//   node seed.js                  -> demo users + their listings
//   node seed.js you@email.com    -> also adds a few listings to your own account
//   node seed.js --reset          -> deletes the demo users' listings first, then adds them again
//   node seed.js --photos         -> only fills in photos for demo listings that don't have one yet
// Safe to run more than once: demo users that already have listings are skipped (unless --reset).
// Photos are looked up on Wikimedia Commons (free to reuse) while seeding, so you need internet.
// If no photo is found for an item, it is listed without one.

const dotenv = require('dotenv');
dotenv.config({ path: './config.env' });

const mongoose = require('mongoose');
const User = require('./models/User');
const Listing = require('./models/Listing');

const DEMO_PASSWORD = 'password123';

const demoUsers = [
    {
        name: 'Theo Tan',
        email: 'theo@demo.com',
        wants: ['Music', 'turntable', 'film lens'],
        listings: [
            { title: 'Canon AE-1 Program', category: 'Cameras', condition: 'Excellent', description: 'Classic 35mm film camera with a 50mm f/1.8 lens. Light meter works, shutter is accurate. Small scuff on the top plate.', lookingFor: 'turntable, vinyl records' },
            { title: 'Fujifilm Instax Mini 11', category: 'Cameras', condition: 'Like new', description: 'Used at two parties. Comes with the strap and a half-used film pack.', lookingFor: 'bluetooth speaker' },
            { title: 'Logitech MX Keys keyboard', category: 'Tech', condition: 'Good', description: 'Wireless backlit keyboard, pairs with three devices. Some shine on the space bar.', lookingFor: 'film lens, books' },
            { title: 'Olympus Mju II', category: 'Cameras', condition: 'Good', description: 'Compact point-and-shoot film camera. Flash works, lens is clean. Battery included.', lookingFor: 'vinyl records' },
            { title: 'Manfrotto travel tripod', category: 'Cameras', condition: 'Excellent', description: 'Aluminium tripod, folds to 40 cm. Ball head with quick-release plate.', lookingFor: 'headphones' },
            { title: 'Fujifilm X-T20 body', category: 'Cameras', condition: 'Good', description: 'Mirrorless camera body only, about 15k shutter count. Two batteries and charger.', lookingFor: 'turntable, speakers' }
        ]
    },
    {
        name: 'Mei Lin',
        email: 'mei@demo.com',
        wants: ['Cameras', 'Books'],
        listings: [
            { title: 'Audio-Technica AT-LP60X turntable', category: 'Music', condition: 'Good', description: 'Fully automatic belt-drive turntable. Built-in preamp, works with any powered speaker. Dust cover has light scratches.', lookingFor: 'film camera' },
            { title: 'Yamaha acoustic guitar F310', category: 'Music', condition: 'Fair', description: 'Great beginner guitar. Plays well but has a few dings on the body. Comes with a soft case.', lookingFor: 'camera, keyboard' },
            { title: 'Harry Potter box set (books 1-7)', category: 'Books', condition: 'Good', description: 'Paperback set, all seven books. Spines are creased but every page is intact.', lookingFor: 'novels, board games' },
            { title: 'Taylor Swift 1989 vinyl', category: 'Music', condition: 'Like new', description: 'Played twice, sleeve in great condition. Comes with the lyric insert.', lookingFor: 'film camera, books' },
            { title: 'JBL Flip 5 speaker', category: 'Music', condition: 'Good', description: 'Waterproof bluetooth speaker, about 10 hours of battery. Some marks on the fabric.', lookingFor: 'instant camera' },
            { title: 'Casio CT-S300 keyboard', category: 'Music', condition: 'Excellent', description: '61-key portable keyboard with power adapter and music stand. Light-up lesson function.', lookingFor: 'books, camera' }
        ]
    },
    {
        name: 'Arjun Kumar',
        email: 'arjun@demo.com',
        wants: ['Outdoors', 'Tech'],
        listings: [
            { title: 'Quechua 2-person tent', category: 'Outdoors', condition: 'Excellent', description: 'Pop-up tent, used on one camping trip at East Coast. Packs into its own bag.', lookingFor: 'headphones, power bank' },
            { title: 'Uniqlo Ultra Light Down jacket (M)', category: 'Clothing', condition: 'Like new', description: 'Navy, size M. Bought for a winter trip and worn twice. Folds into its pouch.', lookingFor: 'hiking backpack' },
            { title: 'IKEA desk lamp', category: 'Home', condition: 'Good', description: 'Adjustable arm LED desk lamp, warm light. Fine for a study table.', lookingFor: 'anything Tech' },
            { title: 'Osprey 40L hiking backpack', category: 'Outdoors', condition: 'Good', description: 'Carry-on size travel pack with hip belt. One small stain inside, zips all work.', lookingFor: 'power bank, earbuds' },
            { title: 'Camping stove and gas canister set', category: 'Outdoors', condition: 'Excellent', description: 'Compact butane stove, used three times. Two unopened canisters included.', lookingFor: 'tech accessories' },
            { title: 'Anker 20000mAh power bank', category: 'Tech', condition: 'Good', description: 'Charges a phone about four times. USB-C and USB-A ports. Cable included.', lookingFor: 'tent pegs, hammock' }
        ]
    },
    {
        name: 'Sophie Ng',
        email: 'sophie@demo.com',
        wants: ['Toys', 'Home', 'turntable'],
        listings: [
            { title: 'LEGO Creator 3-in-1 house', category: 'Toys', condition: 'Excellent', description: 'Complete set with instructions, built once and taken apart. All pieces bagged.', lookingFor: 'board games' },
            { title: 'Catan board game', category: 'Toys', condition: 'Good', description: 'Base game, all pieces included. Box corners are a bit worn.', lookingFor: 'LEGO, books' },
            { title: 'Sony WH-1000XM4 headphones', category: 'Tech', condition: 'Good', description: 'Noise-cancelling headphones with case and cable. Battery still lasts a full day. Ear pads slightly worn.', lookingFor: 'tent, turntable' },
            { title: 'Exploding Kittens card game', category: 'Toys', condition: 'Like new', description: 'Party pack edition, opened once. All cards present.', lookingFor: 'home decor' },
            { title: 'Muji aroma diffuser', category: 'Home', condition: 'Excellent', description: 'Ultrasonic diffuser with timer and soft light. Comes with a small lavender oil.', lookingFor: 'turntable, LEGO' },
            { title: 'Ticket to Ride board game', category: 'Toys', condition: 'Good', description: 'All trains and cards included. Board has a light crease.', lookingFor: 'plants, home items' }
        ]
    },
    {
        name: 'Marcus Lim',
        email: 'marcus@demo.com',
        wants: ['Tech', 'Clothing', 'sneakers'],
        listings: [
            { title: 'Nintendo Switch Lite (turquoise)', category: 'Tech', condition: 'Good', description: 'Works perfectly, small scratch on the back. Comes with charger and a case.', lookingFor: 'sneakers, jacket' },
            { title: 'Apple AirPods (2nd gen)', category: 'Tech', condition: 'Fair', description: 'Both earbuds work, battery about 2 hours. Case has scuffs. Cleaned and sanitised.', lookingFor: 'clothing, caps' },
            { title: 'Adidas Samba OG (UK 8)', category: 'Clothing', condition: 'Excellent', description: 'White and black, worn about five times. Box included.', lookingFor: 'gaming gear' },
            { title: 'Mario Kart 8 Deluxe (Switch)', category: 'Toys', condition: 'Like new', description: 'Game cartridge in original case. Played for a week.', lookingFor: 'tech accessories' },
            { title: 'Razer DeathAdder gaming mouse', category: 'Tech', condition: 'Good', description: 'Wired mouse, all buttons work. Grip tape added on the sides.', lookingFor: 'streetwear' },
            { title: 'The North Face windbreaker (L)', category: 'Clothing', condition: 'Good', description: 'Black, packable hood. Light fading on the cuffs.', lookingFor: 'tech, games' }
        ]
    },
    {
        name: 'Priya Raj',
        email: 'priya@demo.com',
        wants: ['Books', 'Home', 'plants'],
        listings: [
            { title: 'Monstera deliciosa plant', category: 'Home', condition: 'Excellent', description: 'About 60 cm tall with six leaves, in a ceramic pot. Healthy and growing.', lookingFor: 'books, novels' },
            { title: 'Sapiens by Yuval Noah Harari', category: 'Books', condition: 'Good', description: 'Paperback, some pencil underlines in the first chapters.', lookingFor: 'plants, home decor' },
            { title: 'Philips air fryer (4.1L)', category: 'Home', condition: 'Good', description: 'Works well, basket non-stick coating still fine. Cleaned before listing.', lookingFor: 'cookbooks, novels' },
            { title: 'Pride and Prejudice (Penguin Clothbound)', category: 'Books', condition: 'Like new', description: 'Hardcover clothbound edition. Bought as a gift, never read.', lookingFor: 'plants, candles' },
            { title: 'Set of 4 ceramic plates', category: 'Home', condition: 'Excellent', description: 'Speckled glaze dinner plates, no chips. From a cafe-style homeware shop.', lookingFor: 'books' },
            { title: 'The Midnight Library by Matt Haig', category: 'Books', condition: 'Good', description: 'Paperback, read once. Slight wave on a few pages from the humidity.', lookingFor: 'pots, plants' }
        ]
    },
    {
        name: 'Daniel Wong',
        email: 'daniel@demo.com',
        wants: ['Outdoors', 'Music', 'bicycle'],
        listings: [
            { title: 'Brompton-style foldable bike', category: 'Outdoors', condition: 'Fair', description: 'Folding bicycle, 16-inch wheels. Rides fine but chain needs oiling. Some rust on the bolts.', lookingFor: 'guitar, speakers' },
            { title: 'Decathlon yoga mat', category: 'Outdoors', condition: 'Like new', description: '6 mm thick, grey, used a handful of times. Comes with a carry strap.', lookingFor: 'music gear' },
            { title: 'Ukulele (soprano) with bag', category: 'Music', condition: 'Good', description: 'Mahogany soprano ukulele, strings replaced last month. Tuner included.', lookingFor: 'camping gear' },
            { title: 'Coleman camping chair', category: 'Outdoors', condition: 'Excellent', description: 'Folding chair with cup holder. Used for one beach picnic.', lookingFor: 'bluetooth speaker' },
            { title: 'Shure SM58 microphone', category: 'Music', condition: 'Good', description: 'Industry-standard vocal mic. XLR cable included. Grille has a small dent.', lookingFor: 'bicycle accessories' },
            { title: 'Bike helmet (size M)', category: 'Outdoors', condition: 'Excellent', description: 'Adjustable fit, no impacts. Front light clip on top.', lookingFor: 'ukulele strings, music books' },
            { title: 'Snorkelling set with fins (M)', category: 'Outdoors', condition: 'Good', description: 'Mask, snorkel and fins in a mesh bag. Used on a Tioman trip.', lookingFor: 'headphones' }
        ]
    },
    {
        name: 'Hannah Lee',
        email: 'hannah@demo.com',
        wants: ['Clothing', 'Cameras', 'Other'],
        listings: [
            { title: 'Zara linen blazer (S)', category: 'Clothing', condition: 'Like new', description: 'Beige, size S. Worn to one interview. Dry cleaned.', lookingFor: 'film camera' },
            { title: 'Coach crossbody bag', category: 'Clothing', condition: 'Good', description: 'Black leather, adjustable strap. Light wear on the corners.', lookingFor: 'instant camera, books' },
            { title: 'Polaroid Now camera', category: 'Cameras', condition: 'Excellent', description: 'Instant camera, white. Autofocus works great. Film not included.', lookingFor: 'clothing, bags' },
            { title: 'Canon EF 50mm f/1.8 lens', category: 'Cameras', condition: 'Good', description: 'Nifty fifty for Canon DSLRs. Clean glass, front and rear caps included.', lookingFor: 'dresses, jackets' },
            { title: 'Washi tape and journal set', category: 'Other', condition: 'Like new', description: 'Dotted A5 journal plus 20 rolls of washi tape. Only a few used.', lookingFor: 'camera accessories' },
            { title: 'Ray-Ban Wayfarer sunglasses', category: 'Clothing', condition: 'Good', description: 'Classic black, comes with case. Tiny scratch on the left lens edge.', lookingFor: 'film, lens' },
            { title: 'Handmade crochet tote bag', category: 'Other', condition: 'Excellent', description: 'Cream cotton tote, fits a laptop. Made by me, used twice.', lookingFor: 'camera, clothing' }
        ]
    }
];

// A few items for your own account, so you can test My Listings and proposing trades
const myListings = [
    { title: 'Kindle Paperwhite (10th gen)', category: 'Tech', condition: 'Excellent', description: 'Waterproof e-reader, 8 GB. Comes with a fabric cover. No scratches on the screen.', lookingFor: 'film camera, turntable' },
    { title: 'Nike running shoes (US 9)', category: 'Clothing', condition: 'Fair', description: 'Pegasus 38, about 200 km on them. Still comfortable, soles show some wear.', lookingFor: 'tent, outdoors gear' },
    { title: 'Atomic Habits by James Clear', category: 'Books', condition: 'Like new', description: 'Paperback, read once. No highlights or notes.', lookingFor: 'novels, board games' }
];

// What to search Wikimedia Commons for, per listing title
const PHOTO_SEARCH = {
    'Canon AE-1 Program': 'Canon AE-1 Program camera',
    'Fujifilm Instax Mini 11': 'Instax Mini 11',
    'Logitech MX Keys keyboard': 'Logitech keyboard',
    'Olympus Mju II': 'Olympus mju II camera',
    'Manfrotto travel tripod': 'Manfrotto tripod',
    'Fujifilm X-T20 body': 'Fujifilm X-T20',
    'Audio-Technica AT-LP60X turntable': 'Audio-Technica turntable',
    'Yamaha acoustic guitar F310': 'Yamaha acoustic guitar',
    'Harry Potter box set (books 1-7)': 'Harry Potter books',
    'Taylor Swift 1989 vinyl': 'vinyl record sleeve',
    'JBL Flip 5 speaker': 'JBL Flip speaker',
    'Casio CT-S300 keyboard': 'Casio keyboard instrument',
    'Quechua 2-person tent': 'Quechua tent',
    'Uniqlo Ultra Light Down jacket (M)': 'down jacket',
    'IKEA desk lamp': 'desk lamp',
    'Osprey 40L hiking backpack': 'Osprey backpack',
    'Camping stove and gas canister set': 'portable butane stove',
    'Anker 20000mAh power bank': 'power bank',
    'LEGO Creator 3-in-1 house': 'Lego house',
    'Catan board game': 'Catan board game',
    'Sony WH-1000XM4 headphones': 'Sony WH-1000XM4',
    'Exploding Kittens card game': 'card game cards table',
    'Muji aroma diffuser': 'aroma diffuser',
    'Ticket to Ride board game': 'Ticket to Ride board game',
    'Nintendo Switch Lite (turquoise)': 'Nintendo Switch Lite',
    'Apple AirPods (2nd gen)': 'Apple AirPods',
    'Adidas Samba OG (UK 8)': 'Adidas Samba',
    'Mario Kart 8 Deluxe (Switch)': 'Nintendo Switch game cartridge',
    'Razer DeathAdder gaming mouse': 'Razer DeathAdder',
    'The North Face windbreaker (L)': 'The North Face jacket',
    'Monstera deliciosa plant': 'Monstera deliciosa pot',
    'Sapiens by Yuval Noah Harari': 'paperback books stack',
    'Philips air fryer (4.1L)': 'air fryer',
    'Pride and Prejudice (Penguin Clothbound)': 'Penguin clothbound classics',
    'Set of 4 ceramic plates': 'ceramic plates',
    'The Midnight Library by Matt Haig': 'paperback novel',
    'Brompton-style foldable bike': 'Brompton folding bicycle',
    'Decathlon yoga mat': 'yoga mat',
    'Ukulele (soprano) with bag': 'soprano ukulele',
    'Coleman camping chair': 'folding camping chair',
    'Shure SM58 microphone': 'Shure SM58',
    'Bike helmet (size M)': 'bicycle helmet',
    'Snorkelling set with fins (M)': 'snorkel mask fins',
    'Zara linen blazer (S)': 'blazer jacket',
    'Coach crossbody bag': 'leather crossbody bag',
    'Polaroid Now camera': 'Polaroid Now',
    'Canon EF 50mm f/1.8 lens': 'Canon EF 50mm f/1.8',
    'Washi tape and journal set': 'washi tape',
    'Ray-Ban Wayfarer sunglasses': 'Ray-Ban Wayfarer',
    'Handmade crochet tote bag': 'crochet bag',
    'Kindle Paperwhite (10th gen)': 'Kindle Paperwhite',
    'Nike running shoes (US 9)': 'Nike Pegasus running shoe',
    'Atomic Habits by James Clear': 'Atomic Habits book'
};

const usedPhotos = new Set();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Wikimedia blocks clients that ask too quickly (HTTP 429), so space out requests and retry
async function fetchWithRetry(url) {
    for (let attempt = 1; attempt <= 5; attempt++) {
        await sleep(1500);
        const response = await fetch(url, { headers: { 'User-Agent': 'TradeHappySeed/1.0 (SMU IS216 student project)' } });
        if (response.ok) return response.json();
        if (response.status !== 429 && response.status < 500) return null;
        const wait = Number(response.headers.get('retry-after')) || attempt * 5;
        console.log(`  Wikimedia is busy, waiting ${wait}s...`);
        await sleep(wait * 1000);
    }
    return null;
}

// Used when the specific search finds nothing, so every listing still gets a photo
const CATEGORY_PHOTO = {
    Cameras: 'vintage film camera',
    Tech: 'electronics gadget',
    Music: 'musical instrument',
    Books: 'books on shelf',
    Clothing: 'clothing fashion',
    Outdoors: 'camping equipment',
    Home: 'home interior decor',
    Toys: 'board game',
    Other: 'handmade craft'
};

// Try the specific search, then a shorter one, then the category; returns '' only if all fail
async function findPhoto(title, category) {
    const specific = PHOTO_SEARCH[title] || title.replace(/\(.*?\)/g, '').trim();
    const shorter = specific.split(' ').slice(0, 2).join(' ');
    const queries = [...new Set([specific, shorter, CATEGORY_PHOTO[category] || 'object'])];
    for (const query of queries) {
        const photo = await searchCommons(query);
        if (photo) return photo;
    }
    return '';
}

// Search Wikimedia Commons and return an unused photo URL (640 px wide), or ''
async function searchCommons(query) {
    const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
        action: 'query',
        format: 'json',
        generator: 'search',
        gsrsearch: `${query} filetype:bitmap`,
        gsrnamespace: '6',
        gsrlimit: '20',
        prop: 'imageinfo',
        iiprop: 'url|mime',
        iiurlwidth: '640'
    });
    try {
        const data = await fetchWithRetry(url);
        if (!data) return '';
        const pages = Object.values(data.query?.pages || {}).sort((a, b) => a.index - b.index);
        for (const page of pages) {
            const info = page.imageinfo?.[0];
            const photo = info?.thumburl || info?.url;
            if (photo && ['image/jpeg', 'image/png'].includes(info.mime) && !usedPhotos.has(photo)) {
                usedPhotos.add(photo);
                return photo;
            }
        }
    } catch {
        // No internet or Wikimedia unavailable: list the item without a photo
    }
    return '';
}

async function addListings(owner, listings) {
    let withPhoto = 0;
    for (const item of listings) {
        const imageUrl = await findPhoto(item.title, item.category);
        if (imageUrl) withPhoto++;
        // imagePath stays empty: the photo is not in our Supabase bucket, so nothing to delete later
        await Listing.addListing({ ...item, owner: owner._id, imageUrl, imagePath: '' });
    }
    return withPhoto;
}

async function seed() {
    await mongoose.connect(process.env.DB);
    console.log('Connected to MongoDB');

    const args = process.argv.slice(2);
    const reset = args.includes('--reset');
    const myEmail = args.find((a) => !a.startsWith('--'));

    if (args.includes('--photos')) {
        const demoIds = (await Promise.all(demoUsers.map((d) => User.findByEmail(d.email)))).filter(Boolean).map((u) => u._id);
        const all = await Listing.Listing.find({ owner: { $in: demoIds } });
        all.filter((l) => l.imageUrl).forEach((l) => usedPhotos.add(l.imageUrl));
        const missing = all.filter((l) => !l.imageUrl);
        console.log(`${missing.length} demo listings need a photo (takes about ${Math.ceil(missing.length * 2 / 60)} min)`);
        let filled = 0;
        for (const listing of missing) {
            const imageUrl = await findPhoto(listing.title, listing.category);
            if (imageUrl) {
                await Listing.Listing.updateOne({ _id: listing._id }, { imageUrl });
                filled++;
                console.log(`  Photo added: ${listing.title}`);
            } else {
                console.log(`  No photo found: ${listing.title}`);
            }
        }
        console.log(`\nDone. Added ${filled} photos.`);
        await mongoose.disconnect();
        return;
    }

    for (const demo of demoUsers) {
        let user = await User.findByEmail(demo.email);
        if (!user) {
            user = await User.createUser(demo.name, demo.email, DEMO_PASSWORD);
            await User.updateWants(user._id, demo.wants);
        }
        if (reset) {
            const { deletedCount } = await Listing.Listing.deleteMany({ owner: user._id });
            if (deletedCount) console.log(`Removed ${deletedCount} old listings for ${demo.email}`);
        }
        const existing = await Listing.Listing.countDocuments({ owner: user._id });
        if (existing > 0) {
            console.log(`Skipped ${demo.email} (already has listings)`);
            continue;
        }
        const photos = await addListings(user, demo.listings);
        console.log(`Added ${demo.listings.length} listings for ${demo.email} (${photos} with photos)`);
    }

    if (myEmail) {
        const me = await User.findByEmail(myEmail);
        if (!me) {
            console.log(`No account found for ${myEmail}. Register in the app first, then run this again.`);
        } else {
            const photos = await addListings(me, myListings);
            console.log(`Added ${myListings.length} listings for ${myEmail} (${photos} with photos)`);
        }
    }

    console.log(`\nDone. Demo accounts use the password "${DEMO_PASSWORD}".`);
    await mongoose.disconnect();
}

seed().catch(async (err) => {
    console.error('Seeding failed:', err.message);
    await mongoose.disconnect();
    process.exit(1);
});