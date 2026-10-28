# ESSYRA local n8n website connection

## Current design

The agent runs in the existing local n8n workflow `bpSrmYCuZuC12uAp`, using the owner's saved Groq credential. Five GET-only tools read active public catalogue entries and store policies. The model answers in plain text with exact product links; the local formatter extracts validated catalogue slugs and maps explicit comparison/order/support requests to allowed UI actions. The website builds product cards and comparisons from its actual catalogue; AI output cannot submit an order or choose another customer's identity.

The local workflow is published to a **loopback-only** webhook. The laptop connector makes outbound HTTPS calls to Supabase to lease temporary chat jobs, sends them to local n8n and returns the answer. There is no public tunnel and no public n8n editor. A separate random worker key authorises queue access. It is not a database service-role key, Groq key or customer token. The laptop receives message text, an opaque session identifier and optional public product slug, without customer email, address or authentication tokens. Groq receives the chat conversation and public tool results.

Authenticated website sessions enqueue and retrieve only their own jobs. Anonymous Supabase guest sessions can ask shopping questions; inactive accounts are denied. Limits are five new requests per minute and sixty per rolling 24 hours per account/guest session. These are application limits, not an assurance against all multi-account abuse. The connector leases work every eight seconds when idle, so replies can take several seconds. If it is offline or a provider limit is reached, the website offers its standard store guide and contact route.

Temporary jobs expire after 24 hours and are removed by the next worker maintenance pass. While the laptop is off, expired rows may remain stored. n8n success/error/manual execution retention is disabled, and its five-turn test memory is in process memory. It is not a durable multi-worker memory store. Do not use this SQLite laptop installation as a high-traffic service or claim two-month guaranteed uptime.

Private order lookup remains inside the signed-in website session. Complaints, delivery enquiries, returns and cancellation requests are saved as private support tickets. Customers can read and reply only to their own tickets. Administrator replies and status controls require an active administrator role and MFA. Ticket creation does not cancel an order, authorise a refund or send an email. The existing order-management controls remain responsible for actual fulfilment changes.

## Prepared activation

Activated on 28 October 2026: both migrations installed in project `zhehksxuzyxnurmhwylw`, both functions deployed, and their legacy JWT gateway checks disabled after specific owner approval. The owner saved the separate worker key directly in Supabase. The local connector authenticated successfully. The production site completed a real public-product comparison through the private queue, local n8n and Groq.

The published category buttons open the left drawer with the selected category expanded. Escape restores focus to the opening button. Comparison tables use the website catalogue, with listed/estimated dimension notes, rather than duplicating model-generated table text.

1. Review and install `supabase/migrations/202610280011_support_agent.sql` and `202610280012_support_tickets.sql`. A review copy is saved in the parent workspace as `ESSYRA-support-activation.sql`.
2. Deploy `support-agent` and `support-worker` Edge Functions. They use custom identity/key checks, so their legacy JWT gateway check is off. The customer endpoint verifies the user's Supabase session inside the function; the worker endpoint verifies the dedicated worker key. Both enforce bounded request bodies.
3. In the sibling `essyra-n8n-local` folder, the user double-clicks **Copy ESSYRA Bridge Key.cmd**. On first run it creates a random 32-byte key, saves it with Windows user encryption and copies it to the clipboard without printing it. On later runs it copies the existing key. The user must do this credential step themselves.
4. The user pastes the copied value directly into Supabase Edge Function secrets as **N8N_SUPPORT_WORKER_KEY**, then saves. Never put it in source code, chat, frontend environment variables, screenshots or public exports. The assistant does not need to see the value. Copy something else afterward to clear the clipboard.
5. Run **Start ESSYRA Support.cmd**. This starts local n8n if necessary and runs the outbound connector. Closing its connector window stops website AI replies. Local n8n and the connector must remain running while the laptop stays awake and online.
6. After an end-to-end test, build the website with `VITE_SUPPORT_AGENT_ENABLED=true` and deploy the compiled Vercel artifacts. Until then, the live website is not connected to this worker.

## Validation

- `node scripts/support-security-check.mjs`: queue isolation, missing/foreign ownership, request conflicts, rate limits, lease validation, inactive-account denial and offline behaviour, using local PostgreSQL fixtures.
- `node scripts/support-tickets-check.mjs`: private tickets, anonymous/guest denial, foreign-order denial, no direct writes, admin MFA and no automatic cancellation.
- `node --experimental-strip-types --test src/lib/support-reply.test.ts`: bounded/malicious reply handling and bounded HTTP input.
- `node scripts/support-endpoints-check.mjs`: live unsigned-request denial, allowed-origin preflight, foreign-origin denial and missing-worker-key denial. No customer data, jobs, emails or orders are created by these probes.
- `node check-agent-webhook.mjs` in the local n8n folder: actual Groq response through the local webhook, two exact catalogue items and a structured comparison action; no customer data.
- Browser checks confirmed a live comparison through the entire agent connection, catalogue cards/comparison values, signed-out order and ticket gates, category drawer selection, navigation and Escape focus return. Visual previews covered light/dark presentation. A real signed-in customer/admin ticket submission and reply check remains necessary; production tickets were not created for testing.

## Remaining operational requirements

Free Groq quotas and availability can change. Keep the API key in n8n's encrypted credential store and review account limits. Back up local n8n's database together with its encryption configuration privately. The setup files and credential-free workflow export alone cannot restore an encrypted credential if the encryption configuration is lost. The desktop Cloud trial is not part of this integration. No online-payment provider, courier booking service or marketing campaign is enabled by this work.

## Chat and homepage refinement

Greetings and generic furniture browsing reply immediately in the browser; n8n remains the AI agent for detailed questions. Authentication, send and poll stages have separate deadlines within a forty-second overall request limit. A stalled connection falls back to catalogue guidance, and customers can choose Use store guide while waiting.

The welcome view includes real catalogue images and quick prompts. New chat aborts the pending client request, clears the visible conversation and changes its session identifier; server-side temporary jobs still follow the existing retention policy. Settings control suggested questions and larger text. Current deals use saved catalogue sale prices. The public get_store_bestsellers routine returns only active product slugs ranked from paid, delivered orders, never order/customer records or fabricated counts. Empty rankings are stated honestly.

The homepage collection carousel uses existing catalogue images with native links, scrolling, navigation, pause controls and reduced-motion support. It pauses while hovered or keyboard-focused. No reference recordings or Habitt assets are published.
