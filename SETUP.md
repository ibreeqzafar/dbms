# ESSYRA service setup

The supplied project is connected at `https://zhehksxuzyxnurmhwylw.supabase.co`. The public publishable key belongs in frontend configuration. Database passwords, service-role keys, Google client secrets, SMTP passwords and AI keys must never be added to frontend code or chat.

## Google sign-in

1. Create a Google Cloud project and configure Google Auth Platform branding as ESSYRA. Configure the audience/test users and only the `openid`, email and profile scopes.
2. Create an OAuth client of type **Web application**. Authorized JavaScript origin: `https://essyra-home.quietibex64.chatgpt.site`.
3. Add the authorized redirect URI `https://zhehksxuzyxnurmhwylw.supabase.co/auth/v1/callback`.
4. In Supabase → Authentication → Sign In / Providers → Google, enter the client ID and secret directly and enable the provider.
5. In Authentication → URL Configuration, set Site URL to the ESSYRA origin and add `https://essyra-home.quietibex64.chatgpt.site/account` and `/account/recovery` as explicit redirect URLs.
6. Set `VITE_GOOGLE_AUTH_ENABLED=true`, rebuild and republish only after the provider works. For local testing add the exact localhost origin and redirect to both services, and remove development redirects before public launch.

Official instructions: https://supabase.com/docs/guides/auth/social-login/auth-google

## SMTP and account emails

1. Use an SMTP provider and a sender domain you control. Complete the provider's DNS verification, including SPF/DKIM and its recommended DMARC configuration.
2. In Supabase → Authentication → Email → SMTP Settings, enable custom SMTP and enter the provider's hostname, port, username and password directly. Enter your verified sender address and ESSYRA sender name.
3. Set URL Configuration as above. Review signup, recovery and email-change templates and rate limits.
4. Test registration and recovery with an email account you control. Check spam placement and expiry. The built-in Supabase sender is restricted and is not a general production email service.

Official instructions: https://supabase.com/docs/guides/auth/auth-smtp

## Domain

No purchased domain was supplied. The current Sites origin is the configured canonical origin. Connect a domain you control through supported hosting/domain settings, update `VITE_SITE_URL`, function `SITE_ORIGIN`, Google origins and Supabase redirects together, then rebuild. No business address or opening hours have been invented; local-business structured data needs those real details before eligibility for location-based rich results.

## Room storage and real AI

`recommendations` and `room-assets` are deployed. The two SQL migrations and all 517 products/variants are installed. Private asset reads enforce ownership, expiry and soft deletion. Room photos never receive public URLs. Access expires after 24 hours. Physical removal needs the provided maintenance function to be deployed with a protected scheduler; it has not been scheduled. Until then, do not use this practice build to collect real room photos.

Real text/vision/image provider credentials, preview worker polling/result ingestion, scheduler secrets and payment-provider configuration are not supplied. Real image rendering and payment collection remain disabled. Free browser overlays reserve no image quota. SQL quota/lease/idempotency routines are present and exercised in PostgreSQL tests; this does not constitute a configured live image provider.

## Administrator

Use a verified Supabase customer account. Assign `administrator` only through trusted database administration; customers cannot assign it themselves. Enrol an authenticator using the admin screen and verify MFA for AAL2 before catalogue mutations. There is no default admin password. No real account or admin identity was fabricated during development.

## Replace sample data

Storefront branding is ESSYRA and catalogue content is labelled as a demonstration. Original source records remain in `src/data/catalogue.json` and the development audit; they are not a claim that ESSYRA manufactures the photographed products. Replace images and specifications with the brand's approved catalogue before public commercial use. PKR prices and stock are synthetic. Checkout creates practice orders only.
