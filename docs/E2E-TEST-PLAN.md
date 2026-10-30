# End-to-end (E2E) test plan

E2E tests use Playwright. A real browser opens the app, clicks and types like a user, and checks what appears on screen.

## How to run

```bash
pnpm install
npx playwright install chromium
pnpm test:e2e              # everything
pnpm test:e2e:real         # real stack only: browser -> Vue -> Express -> MongoDB
pnpm test:e2e:mocked       # fast UI checks with a fake API (no database needed)
HEADED=1 pnpm test:e2e:real   # watch the browser
npx playwright show-report    # open the HTML report
```

Playwright starts its own Vue app (port 5174) and its own Express server (port 8100). Express uses a **separate database
called `tradehappy_e2e`** (same MongoDB server as `server/config.env`, different database name), so your normal data is never touched.
Set `E2E_DB` to use a different MongoDB. Each real test registers its own new users and listings with unique names, so tests never
depend on old data and nothing needs resetting.

## Core feature coverage

| Core feature | What is checked | Spec file |
| --- | --- | --- |
| Accounts | Register, log out, log in, wrong password, duplicate email, protected pages redirect to login and back | `e2e/real/auth.spec.js` |
| Listings | Create, appears in My listings, found by search, edit, delete, category filter, required fields | `e2e/real/listings.spec.js` |
| Wants and smart matching | Add a want, listing appears in "Fresh matches" with a match score, remove a want | `e2e/real/matching.spec.js` |
| Like and save | Like and save, stored after reload, shown on profile tabs, owner sees it on Likes, owner cannot like own item | `e2e/real/reactions.spec.js` |
| People and profiles | Search by name, open a public profile, empty search | `e2e/real/people.spec.js` |
| Trade proposals | Propose, accept, reject, counter offer, withdraw, cancel an accepted trade, My trades tabs | `e2e/real/trade-proposal.spec.js` |
| Chat | Two users send and receive messages, chat search | `e2e/real/chat.spec.js` |
| Meetup | Search a place (OneMap), pick day and time, save, other person sees it, change it | `e2e/real/meetup.spec.js` |
| Checklist, handover, reviews | Tick every item, confirm handover (locked until all ticked), trade completes, items marked Traded, rate the other person, review shows on their profile, ticks are saved | `e2e/real/checklist-and-review.spec.js` |

Extra, fast layer with a fake API (login, register, guards, browse, create listing, logout, empty states): `e2e/mocked/`.

## Notes

- The only thing answered by a test double in the real suite is the OneMap place search (a free public internet API), so the test does
  not depend on the internet. Our own Express server and MongoDB are always real.
- Photo upload (Supabase Storage) is not covered. Listings in tests have no photo.
- Real tests leave a few test users and listings in the `tradehappy_e2e` database. Drop that database any time to clean up.
