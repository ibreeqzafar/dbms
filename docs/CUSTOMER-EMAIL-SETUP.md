# Customer records and email updates

Migration `202610240004_customer_relationships.sql` is independent of checkout migration 003. Apply only this migration when activating customer relationships; do not activate checkout as a side effect.

- Supabase Auth creates the identity and stores passwords securely. The private `customer_contacts` table mirrors name, email, verification and registration time. It never copies passwords or tokens.
- Registration offers an unchecked, optional marketing checkbox. Existing customers default to opted out. Consent is recorded with its notice version and time.
- Customers can subscribe or unsubscribe in Account. A subsequent email verification must not undo an unsubscribe. Changing the email address removes consent for the new address.
- Administrators can read the customer directory only with an active administrator role and MFA assurance level 2. Public and anonymous visitors cannot read it; customers can read only their own row.
- No campaign sender, automation, or background email job is enabled by this migration or frontend.

## Before sending a campaign

Connect a transactional/marketing email provider you control and verify the sender. Store SMTP/API credentials only in secure server settings. Supabase custom SMTP primarily handles authentication messages; it is not a bulk marketing campaign service.

A future sender must query current consent and the active profile at send time, using only `marketing_opt_in=true`, `email_verified=true`, and `profiles.active=true`. Respect provider suppression lists, bounces, complaints and delivery limits. Include a working unsubscribe link in every marketing email. Do not send a campaign until that link and the delivery integration have been implemented and verified. Account unsubscribe is already available, but is not a substitute for an unsubscribe link in each email.

Customer marketing messages should announce real products, offers or sales with accurate terms. The site currently does not send any campaigns.
