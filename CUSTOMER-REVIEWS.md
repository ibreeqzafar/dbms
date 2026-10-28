# Customer reviews and DBMS test data

The public storefront displays only customer_product_reviews returned by get_customer_reviews. Legacy catalogue_reviews are preserved as fictional fixtures but no longer loaded into public ratings. No historical purchases are invented in store_orders or auth.users.

Customers: open Account > Your orders > Write a review, or a delivered product's Ratings & reviews section. One review per customer/product; delivery ownership and 1-5 stars are checked in SQL. First name and review text are public; account, order and email IDs stay private. Negative ratings are accepted. Retrying the same submission is idempotent.

Admin > Test data: 750 fictional customers, 600 fictional orders and 500 fictional reviews dated January-October 2026. Tables project_test_customers, project_test_orders and project_test_reviews have foreign keys, constraints and admin-plus-MFA read policies. Reserved example.invalid addresses cannot be used for mail. These records never affect login, inventory, real sales, customer counts or public best-seller rankings. Exports are marked test data.

Useful SQL for the DBMS project:

```sql
select c.id,c.name,count(o.id) as orders
from project_test_customers c left join project_test_orders o on o.customer_id=c.id
group by c.id,c.name order by orders desc;

select o.product_slug,sum(o.quantity) as delivered_test_units,avg(r.rating) as test_rating
from project_test_orders o left join project_test_reviews r on r.order_id=o.id
where o.state='delivered' group by o.product_slug order by delivered_test_units desc;
```

Review invitations:
- A new transition to delivered queues one invitation only when the registered email is confirmed. No historical backfill.
- The private laptop connector checks the queue about every five minutes while running. It receives status only; email addresses stay on the Supabase server.
- Configure BREVO_API_KEY (restricted to transactional email), REVIEW_EMAIL_SENDER (verified in Brevo), and REVIEW_EMAIL_ENABLED=true in Supabase Edge Function Secrets. Never put credentials in frontend environment variables or Git.
- Email sending remains disabled if the flag/key/sender is missing. Existing Supabase Auth SMTP credentials are separate.
- Messages ask for honest feedback and link to product review sections. They contain no promotion. Users sign in before submitting; no automatic login links.
- A lease prevents two senders taking the same job. Provider idempotency uses order UUID; ambiguous failures are marked failed for staff investigation, not blindly retried. Provider acceptance is not proof of inbox delivery.
- project_test_* tables cannot queue email. No test emails are sent by migrations or local tests.

Tests: npm run test:reviews checks purchase ownership, guest denial, duplicate submissions, rating bounds, private IDs, email leases, test-data counts, admin MFA and isolation from real customer tables.

Brevo implementation reference: https://developers.brevo.com/reference/send-transac-email

Admin usability update: the dashboard defaults to the clearly marked Project demo record mode. Overview, Orders and Customers use the isolated project tables; choose Live store for actual registrations/orders. Catalogue/product/sale controls always update the storefront and the banner states this explicitly. Demo order updates go through manage_project_test_order with admin + MFA checks; they never change actual orders or queue email. Processed project orders can be dispatched or cancelled; dispatched project orders can be delivered. Final states cannot be reopened. The live order report now follows its date filter. Live order rows have a Manage order affordance and explicit cancellation confirmation. Product and sale editors scroll into view and focus their first input; updates have a timeout and success/error feedback.

Presentation: generated records have a single clear Demo environment badge instead of repetitive warning paragraphs. Display aliases use ESS/CUS/REV IDs and generated names with reserved example.com addresses; database fixture IDs and non-deliverable stored contacts are unchanged. Order actions always submit the original fixture key. Exported reports retain their demonstration-data notice.
