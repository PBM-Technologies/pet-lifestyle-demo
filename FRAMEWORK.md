# Pet Lifestyle — Product Framework

## Purpose
Build a production-capable, mobile-first consumer application. This repository currently contains an earlier demo page; it is NOT the production application.

## Product modules
1. auth and households
2. pets and care records
3. places discovery and verified pet policies
4. trips and itineraries
5. community and events
6. mystery box subscriptions
7. marketplace and partners
8. notifications

## Navigation / route inventory
- `/`
- `/explore`
- `/explore/:placeId`
- `/travel`
- `/travel/:tripId`
- `/pets`
- `/pets/:petId`
- `/care`
- `/community`
- `/events`
- `/boxes`
- `/boxes/build`
- `/shop`
- `/account`

## Data domains
- `users`
- `households`
- `household_members`
- `pets`
- `pet_documents`
- `care_events`
- `places`
- `place_policies`
- `place_reviews`
- `saved_places`
- `trips`
- `trip_stops`
- `community_posts`
- `events`
- `box_plans`
- `box_preferences`
- `subscriptions`
- `orders`
- `partners`
- `notifications`

## Architecture
- Frontend: Next.js App Router + TypeScript + responsive design system, server-rendered public pages and authenticated private pages.
- Backend: versioned route handlers/service layer, schema validation, centralized authorization, audit logging.
- Database: PostgreSQL, tenant-scoped records, migrations, constraints, backups.
- Auth: managed provider, verified identity, role-based household membership; no passwords stored by application.
- Storage: private pet/flock records and images with signed access; public marketing assets separate.
- Jobs: scheduled reminders, subscription lifecycle and notification queues with retry/idempotency.
- Integrations: adapters behind interfaces; no assumed live credentials or unverified partnerships.
- Observability: errors, traces, conversion analytics and privacy-aware audit events.

## Release sequence
1. Foundation: project scaffolding, auth, database migrations, design tokens, CI, deployment environments.
2. First useful workflow: create a pet, save a place, plan a trip.
3. Expand: verified listings, care reminders, community moderation.
4. Commerce: provider integrations, billing, fulfillment and returns, customer support.
5. Beta: consent, privacy/security review, accessibility, tests, analytics, real-device testing.

## Acceptance gates
- Functional desktop and mobile flows, not just static previews.
- User can create/edit/delete their own data; cross-household access is denied.
- Input validation, empty/loading/error states, accessibility and automated tests.
- No production claims until integration, security and end-to-end tests pass.
- Obtain approval for visual design before production rollout.

## Ownership and boundaries
Independent, brand-neutral consumer product. Health Extension and SnugArooz are optional commerce partners, not the identity of the app.
Keep user data, branding, billing, analytics and administrator roles isolated between the two applications. Reuse code packages only, never silently share consumer data.

## Status
Phase 1 (local-first web app) is implemented: Vite + React 18 + TypeScript (strict), hash routing, single-file build, deployable to GitHub Pages. The working product name and partner list live only in `src/config/brand.ts`. The phase 1 stack replaces Next.js for now so the app runs from any static host or a single file; the domain contracts and repository interface are built to carry over.

Implemented
- Every route in the inventory above, as hash routes, plus `/more` and `/notifications`.
- Households and pets: local onboarding (no passwords), pet profiles with compressed photos, allergies, microchip and vet details.
- Care records: vaccines, meds, flea/tick, heartworm, vet visits, grooming, weight history chart, journal, documents; due-soon and overdue logic, repeating items.
- Places: fictional sample listings (labeled) plus user-added places with pet policy fields, search, category and species filters, favorites, private notes and ratings. Verification shows only when the user marks it.
- Trips: dates, pets coming, stops from saved places or free text, species-aware packing checklist, travel reminders.
- Community and events: local event creation with RSVP, labeled sample events, private pet photo feed.
- Mystery boxes: builder with restrictions filled in from allergies, saved plans, checkout disabled.
- Partners: brand.ts-driven partner section linking out only.
- Notifications: derived in-app center with dismiss.
- Account: export JSON, export care CSV, import with validation, delete all.
- Persistence behind `Repository<T>` with a localStorage adapter and in-memory fallback.
- `database/0002_pets.sql` with household-scoped tables for all domains.
- Vitest unit tests (data layer and logic), Playwright phone click-through script, GitHub Pages workflow.

Remaining
- Real auth (managed provider, verified identity, household roles and invites).
- Backend: versioned API, server-side authorization against `household_members`, audit logging, a Postgres or Firebase repository adapter, private object storage for photos and documents.
- A real places data provider and a verified-policy workflow (sources, moderation, freshness).
- Community sharing: follows, visibility, moderation, reporting.
- Commerce: billing provider, subscriptions, orders, fulfillment, returns, support; partner integrations beyond links.
- Push notifications and scheduled reminder jobs.
- Privacy and security review, analytics with consent, real-device and accessibility audit, visual design approval.
- Final product name.
