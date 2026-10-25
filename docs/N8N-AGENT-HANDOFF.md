# Connect the future n8n agents

Current recommendations are deterministic catalogue matches. The support concierge uses the website catalogue and policies. Neither is currently an n8n or LLM agent. The room canvas is a local illustrative overlay; it does not generate a photorealistic room image.

## What to provide when the workflows are ready

Provide each workflow's purpose and production webhook URL: furniture recommendations, room rendering, and support. Put authentication secrets in secure server settings, never in chat, browser code, Git, or Vite environment variables.

## Required integration behavior

- Browser requests go through an ESSYRA server endpoint. The server verifies the Supabase user and active profile before contacting n8n. Do not expose a credential-bearing webhook directly in the frontend.
- The guest recommendation allowance is enforced by migrations 005 and 006, with a full refill 24 hours after the first successful guest generation and the recommendations function. Only successful, nonempty recommendations consume one of three guest turns. Verified customers can continue. Guest identity is tied to a persisted Supabase anonymous session; it is not proof of a unique person across devices or fresh sessions.
- n8n requests need server-held webhook authentication, timeouts, bounded inputs and output validation. Do not trust an account ID, administrator role, payment status, price or remaining allowance supplied by the browser or an agent.
- Before adding paid or expensive generation, reserve a quota slot BEFORE calling the provider and release failed jobs. The current cheap catalogue matcher records successful results atomically after computation; it is not a provider billing reservation system.
- Map suggested catalogue IDs back to active server-side products and check price, quantity, stock, measurements and explicit filters. Unknown products or fabricated availability must be rejected.
- Existing photo consent covers local processing and separately saving to private Supabase storage. It does not authorize sending a room photo to an external AI service. Add explicit provider-processing consent before any external photo transfer.
- Marketing must use current opt-in, email verification, active account status, suppression lists and an email unsubscribe link. Do not connect an agent to unrestricted bulk mail.
- Checkout migration 003 and COD ordering were authorised on 25 October 2026. Safepay remains inactive until its merchant connection is verified. Agents must not claim orders are paid or delivery is booked.

Test greetings, product questions, unrelated questions, guest turns 1–3, fourth-turn rejection, registration, verified sign-in, timeout/retry behavior, failed provider runs and private data isolation before switching from the current matcher/concierge to the workflows.
