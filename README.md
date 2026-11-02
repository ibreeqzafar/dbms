# ESSYRA

Furniture storefront and private administration for a university DBMS project. Frontend: React, TypeScript and Vite. Hosted frontend: https://essyra-home.vercel.app. Backend: Supabase Auth, PostgreSQL, Storage and Edge Functions. Two local n8n/Groq workflows support shopping and interior-design advice.

## Run locally

Use Node 24. Run `npm ci`, copy `.env.example` to `.env.local`, fill in the public Supabase project URL/publishable key and feature flags, then run `npm run dev`. Production build: `npm run build` (output `dist`, no source maps).

## Where the project lives

- `src/`: frontend, customer account, studio, checkout, reviews and private admin UI.
- `public/`: website assets. Product references and provenance are in `src/data/` and `REFERENCE_DATA.md`.
- `supabase/functions/`: protected backend function source; deployed separately to Supabase.
- `supabase/migrations/`: schema, permissions and project catalogue/history migrations. Actual customer accounts, passwords, orders and files remain hosted privately in Supabase.
- `n8n/`: portable workflow definitions without provider credentials.
- `local-n8n/`: laptop service launchers, connector and installation lockfile. Run `npm ci` inside this folder for a fresh installation, then follow its README and `DESIGN-AGENT.md`.
- `specifications/`: supplied SRS/SDS text.

Live customer records, private room photos, secret keys, n8n runtime/database and encryption configuration are deliberately excluded from GitHub. The frontend uses a public Supabase publishable key; row policies and server authentication provide access control. Never put secret keys in `VITE_*` variables.

## Deployment from GitHub

Connect this repository to the existing Vercel project `essyra-home`; use Vite, Node 24, root directory `.`, build `npm run build`, output `dist`. Configure the public variables in `.env.example` in Vercel. Push to `main` to trigger the production deployment after the GitHub integration is connected. GitHub Actions also runs the application/security regression tests.

Supabase's GitHub **Deploy to production** setting was off when checked on 2 November 2026. Leave it off until the migration history of the manually installed production database is reconciled. Uploading SQL source does not back up live rows or redeploy backend functions. Never blindly apply historical migrations to an existing store.

## Validation and limitations

Run `npm test`, `npm run test:database`, `npm run test:admin`, `npm run test:studio`, `npm run test:support`, `npm run test:reviews`, `node scripts/support-workflow-check.mjs` and `npm run build`. See `SECURITY-REVIEW-2026-11-02.md` for the scoped security findings and remaining limitations.

The project uses sourced reference product media and historical synthetic records for demonstration. COD is the only checkout method. Delivery simulation does not verify physical delivery. AI styling is text advice; room cutouts and adjustable illustrative overlays are processed separately. Both local n8n and its connector must remain running on the laptop for model responses. Free provider quotas still apply.
