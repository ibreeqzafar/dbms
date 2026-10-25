# Safepay activation

The owner approved activating migration 202610190003 and cash-on-delivery ordering on 25 October 2026. The production frontend enables order submission after the database migration succeeds. Online payment remains disabled until the merchant connection is configured and verified.

1. In Supabase → Edge Functions → Secrets, enter `SAFEPAY_API_KEY`, `SAFEPAY_SECRET_KEY`, `SAFEPAY_WEBHOOK_SECRET` and `SAFEPAY_ENVIRONMENT=production`. Use keys belonging to the ESSYRA merchant. Never put secret keys in chat, frontend environment variables or the repository.
2. Deploy `store-payments`. Its gateway JWT check is off because Safepay webhooks do not have a Supabase JWT; customer actions still verify Supabase identity, ownership and active profile internally. Webhook actions require Safepay HMAC verification and an authoritative server-side tracker lookup.
3. In Safepay → Developers → Endpoints, add `https://zhehksxuzyxnurmhwylw.supabase.co/functions/v1/store-payments?webhook=1` and subscribe to `payment.succeeded` version 2.0.0. Enter its shared HMAC secret in Supabase.
4. Verify return URLs and payment verification with your merchant test environment before enabling live payment. A customer or owner must perform payment/card entry themselves. Do not enable online payment against catalogue items you cannot supply.
5. After successful verification, set `onlinePaymentsEnabled` in the public settings row to true. This alone is not evidence that payments have been tested.

The customer confirms the item total before leaving for Safepay. Card entry happens on Safepay’s hosted checkout. A return URL cannot mark an order paid. Only a server lookup matching the saved tracker, merchant, currency, amount and `TRACKER_ENDED` state can do so. COD is marked collected by an administrator with MFA after delivery. Courier booking and delivery still require the business’s own operational arrangements.

Official integration: https://safepay-docs.netlify.app/build-your-integration/express-checkout/?platform=web
