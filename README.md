# TradeHappy

IS216 G5 project (Mok of all trades). A platform for trading pre-used items: list items, get matched, propose trades, chat, pick a meetup point and inspect items at handover.

## Stack

- **Frontend:** Vue 3 (Composition API) + Vue Router + Pinia + Bootstrap 5 + Axios, built with Vite (project root)
- **Backend:** Node.js + Express + MongoDB (Mongoose), sessions for login (`server/`)
- **Images:** Supabase Storage (`src/lib/storage.js`)
- **Maps:** OneMap search and static map API (no key needed)

## Where each feature lives

| Feature | Owner | Frontend | Backend |
| --- | --- | --- | --- |
| 1. Listings, search & matching | Agnella | `HomeView`, `ListingFormView`, `ListingDetailView`, `MyListingsView`, `ProfileView` | `listingController.js`, `utils/matching.js` |
| 2. Trade proposals | Valerie | `ProposeTradeView`, `TradesView`, `TradeDetailView`, `ItemPicker` | `tradeController.js` (create/accept/reject/counter/cancel) |
| 3. Chat | Ze Xin | `ChatBox` (polls every 3 s) | `messageController.js` |
| 4. Meetup map | Donald | `MeetupPicker` | `tradeController.setMeetup` |
| 5. Inspection checklist | Jing Wen | `InspectionChecklist` | `tradeController.updateChecklist/confirmHandover`, `utils/checklists.js` |

## Setup (each teammate, once)

```sh
pnpm install                 # frontend packages
cd server && pnpm install    # backend packages
```

1. In the project root, create `.env.local` with the Supabase values (ask the group):
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
2. In the `server` folder, create `config.env` (ask the group for the connection string):
   ```
   DB=mongodb+srv://...
   SECRET=any-long-random-text
   PORT=8000
   ```
3. In Supabase, run `supabase/storage-setup.sql` once in the SQL Editor (already done for our project).

Never commit `.env.local` or `server/config.env`; both are in `.gitignore`.

## Run in development

Use two terminals:

```sh
# Terminal 1: API on http://localhost:8000
cd server
pnpm dev

# Terminal 2: Vue app on http://localhost:5173
pnpm dev
```

Vite forwards every `/api` request to the Express server (see `vite.config.js`), so the login cookie works without extra setup.

## Production (e.g. AWS EC2)

```sh
pnpm build          # builds the Vue app into dist/
cd server
pnpm start          # Express serves the API and dist/ on port 8000
```

## Tests and lint

```sh
pnpm test:unit      # Vitest component tests
pnpm test:e2e       # Playwright (run `npx playwright install` first)
pnpm lint
```
