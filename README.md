# Patches (pet lifestyle app; name, logo and colors live in `src/config/brand.ts`)

A mobile-first consumer web app for a pet's whole life: care records, pet-friendly places, trips, events and mystery box plans, in one place. It works for dog people and cat people (and everyone else). Independent and brand-neutral; partner brands are optional links.

The working product name, tagline, colors, logo and partner list all live in **`src/config/brand.ts`**. The page title, meta tags, CSS color tokens, web app manifest and in-app copy read from that file, so a rename is a one-file change. A unit test (`tests/brand.test.ts`) fails if the name, tagline or a partner name gets hardcoded anywhere else.

## Run it

```bash
npm install
npm run dev        # local dev server
npm test           # vitest unit tests
npx tsc --noEmit   # strict type check
npm run build      # emits ONE self-contained dist/index.html
```

`dist/index.html` runs on its own: open it from disk, email it or host it anywhere. Routing uses the URL hash (`#/pets/abc`), so it works without server rewrites. The only external request is optional Google Fonts, with system font fallbacks. `dist/` also gets `manifest.webmanifest`, `icon.svg` and `sw.js`, which are only used when served over http(s).

### Phone click-through test

```bash
npm run build && (cd dist && python3 -m http.server 4173 &)
pip install playwright && python -m playwright install chromium
python3 tests/e2e/smoke.py http://localhost:4173/index.html ./shots
```

At 390x844 it adds a pet with a photo, logs a vaccine, weight and note, adds, saves and verifies a place, builds a trip with stops and checks packing items, creates an event and a post, builds a box, exports JSON and CSV, reloads to confirm persistence, deletes and re-imports, checks for horizontal overflow at 360px and takes screenshots.

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` runs tests, builds and deploys `dist/` with `actions/upload-pages-artifact` and `actions/deploy-pages` on every push to `main`.
**One-time setup:** in the repo go to Settings > Pages and set **Source** to **GitHub Actions**.

## Structure

```
src/config/brand.ts        name, tagline, colors, logo, partners, sitter providers (single source of truth)
src/contracts/domain.ts    typed domain contracts (shared with a future backend)
src/data/storage.ts        localStorage adapter with try/catch and in-memory fallback
src/data/repository.ts     Repository<T> interface (list/get/upsert/remove) + KV implementation
src/data/db.ts             per-domain repositories, seeding, export/import/delete, CSV
src/data/samples.ts        clearly labeled fictional sample places, events and pets
src/lib/*                  pure logic: dates/age, care due-soon, food estimates, feeding and treat budget, food switch plans, spending, sitter providers and care sheets, plate suggestions and calorie estimates, packing, boxes, places, notifications
src/ai/*                   photo checks: vision adapter (claude.ai runtime, VITE_AI_ENDPOINT, or off) and prompts with output sanitizers
src/content/breeds.ts      original breed guide data for dogs and cats
src/content/foodTypes.ts   original food type guidance for the plate builder (dogs, cats, rabbits, guinea pigs, birds, reptiles)
src/pages/*                screens for every route
src/ui/*                   design system: buttons, sheets, tap-friendly pickers, icons, chart
database/0001_identity.sql users, households, membership, notifications
database/0002_pets.sql     household-scoped tables for every app domain
database/0003_pet_food.sql food and treats per pet, with purchase history
database/0004_food_extras.sql feeding logs, treat logs, food switch plans, expenses, member names
database/0005_sitters.sql  sitter requests, saved sitters, member phones, house notes, pet quirks
database/0006_pet_plates.sql planned daily plates per pet, activity, body shape, spayed or neutered
demo/index.html            the original one-page concept demo (kept for reference)
```

To move to a backend, implement `Repository<T>` for Firebase or a Postgres API and pass it to `createDb`; screens do not change.

## Routes

`#/` home, `#/explore`, `#/explore/:placeId`, `#/travel`, `#/travel/:tripId`, `#/pets`, `#/pets/:petId`, `#/care`, `#/community`, `#/events`, `#/boxes`, `#/boxes/build`, `#/shop`, `#/spending`, `#/sitters`, `#/sitters/new`, `#/sitters/care-sheet`, `#/plate`, `#/plate/:petId`, `#/plate/species/:species`, `#/identify`, `#/health-check`, `#/breeds`, `#/breeds/match`, `#/breeds/:slug`, `#/account`, plus `#/more` and `#/notifications` for the mobile shell.

## Honest limits of this phase

- Data stays on the device (localStorage). No accounts, no sync, no sharing. Household member names are labels for "fed by" only.
- Places are user-added plus a few **fictional sample listings**. No live places provider. A policy only shows as verified when the user marks it verified themselves.
- Events and posts are local. There are no other users.
- Box checkout is disabled ("Coming soon"); no prices exist.
- Partner brands are outbound links only.
- Create a plate gives general food type guidance and a calorie starting estimate (RER x a common multiplier), clearly labeled as a starting point; a vet target always wins. It never names products or prices; Shop links go to partner home pages only.
- Find a sitter links out to sitter sites' home pages (configured in `brand.ts`). None of them offers a public booking API, so there is no in-app search or booking; the user books on their site and marks the request booked here. `src/lib/sitters.ts` is where a partner integration would plug in.
- Reminders are in-app only; no push notifications.
- Photo checks (breed ID, health check) only work where a vision model is available: the claude.ai artifact runtime or a configured `VITE_AI_ENDPOINT`. Otherwise the screens show a calm note and everything else works offline. Results are best guesses, never a diagnosis.
