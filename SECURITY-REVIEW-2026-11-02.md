# Security review — 2 November 2026

Scope: local application and database regression tests, dependency advisories, staged-source/known-secret scanning, local workflow boundaries and deployment configuration. This is not an independent penetration test or a guarantee of security.

Passed locally: domain/catalogue tests; administrator MFA and inactive-role denial; role escalation denial; customer order/contact isolation; server-calculated checkout totals, stock and idempotency; guest checkout denial; restricted fulfilment transitions; delivered-purchase review ownership, rating bounds and duplicate prevention; private invitation queue and worker leases; customer ticket isolation; chat rate limits and ownership; restricted public ranking projections; image URL allowlisting and denial of private/spoofed hosts.

`npm audit` for the website reported zero known advisories on this date. Production build succeeds with source maps disabled and separate lazy designer/admin/3D chunks. No test orders, payment collection or marketing campaigns were created by these checks.

The separate installed n8n 2.45.4 dependency tree reported 178 affected dependency entries (5 low, 84 moderate, 81 high, 8 critical). These counts include propagated transitive dependency findings; they are not 178 demonstrated exploitable paths in these workflows. A stable patch update is being evaluated separately. Do not use `npm audit fix --force`: its proposed downgrade to n8n 1.17.0 is not a safe compatibility fix. The local setup is not security-cleared; do not expose its editor or import untrusted workflows. The public application and the local automation environment have separate lockfiles and audit results.

Supabase's GitHub integration was inspected: **Deploy to production is off**, and automatic branching is off. Keep production database automation off until manually installed migration history is reconciled. Vercel Git deployment publishes frontend code only; it does not automatically deploy Edge Functions or replace database rows.

The local n8n editor binds to 127.0.0.1, with no public tunnel. The connector makes outbound authenticated HTTPS requests, and its bridge key is encrypted for the Windows user. Groq credentials remain in n8n credentials. A safe portable workflow omits credential references and secrets; runtime and database backups stay private. Laptop availability, provider limits and local software updates remain operational responsibilities.

Before public release beyond the university project, review all reference-media licences, replace historical synthetic catalogue/analytics records as appropriate, configure monitored email delivery, and use independently verified physical delivery status. The currently approved delivery scheduler simulates delivery for the project; it does not verify a courier.
