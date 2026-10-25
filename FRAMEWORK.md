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
Architecture and interface contracts specified; production implementation, testing and deployment are still pending. The existing root `index.html` remains a prototype.
