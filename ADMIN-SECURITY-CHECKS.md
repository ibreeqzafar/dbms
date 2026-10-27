# Administrator checks — 2026-10-26

## Tested locally in disposable PostgreSQL (PGlite)

`npm run test:admin` checks:

- Anonymous access to private order/contact tables and sale actions is denied.
- A customer sees only their own contact record and cannot promote their profile role.
- Customer calls to product creation/update, settings and sale functions are denied even when their JWT has MFA assurance.
- Administrator actions without MFA and actions by an inactive administrator are denied.
- Sale prices must be positive and lower than the stored regular price. Invented crossed-out prices and arbitrary end-sale prices are rejected.
- Product and variant checkout prices update together. Ending a sale restores the original price.
- Reports separate unpaid COD, paid orders and cancelled orders. CSV exports escape fields and neutralise spreadsheet formulas.

`npm run test:database` checks customer order isolation, server-calculated totals, tampered prices, idempotent checkout, guest denial, prevention of customer payment/fulfilment writes, admin MFA and valid fulfilment transitions.

`node scripts/homelo-database-check.mjs` checks 819 unique products/variants/images, additive and repeatable catalogue migrations, unchanged baseline prices and public read-only access.

## Verified against production

- Anonymous REST requests for store orders and customer contacts returned HTTP 401.
- An anonymous sale RPC call returned HTTP 401; no product was changed by this check.
- The dashboard showed only the restricted-access screen to the browser's non-admin session, with no console errors observed there.
- Production responses include X-Frame-Options DENY, X-Content-Type-Options nosniff, a strict-origin referrer policy and disabled camera/microphone/geolocation browser permissions.
- SQL postflight confirmed 819 active products, 219 Homelo references and the installed admin sale function.
- The owner-approved account role was confirmed as administrator; MFA remains required by database policy.

No real customer order, payment, marketing email, courier booking or test sale was created. No production password was changed. These are scoped access and regression checks, not a claim of an exhaustive independent penetration test. Successful use of the owner's private MFA-protected dashboard still requires the owner to sign in and verify their own authenticator.
