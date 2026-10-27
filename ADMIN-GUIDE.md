# ESSYRA store administration

Open https://essyra-home.vercel.app/admin and sign in with an authorised staff account. Customers and signed-out visitors see an access-denied page. Staff must verify an authenticator code before the dashboard loads private records. An administrator role alone does not bypass the database MFA check.

## Daily management

- **Overview:** recorded collected payments, submitted orders, current products and registered customers. Order figures use the selected 7/30/90/365-day period. No invented orders, sales or visitor figures are displayed.
- **Orders:** inspect items and customer delivery details; move received → processing → dispatched → delivered. Received and processing orders can be cancelled. Record the courier and tracking number manually. Mark COD collected only after delivery and actual collection. Export the selected period to an Excel-compatible CSV.
- **Products & stock:** search and filter, change price/stock, archive and restore products, add new products with permitted image URLs, and export the catalogue. Set stock to zero to display sold-out status. Confirm and maintain inventory manually; order receipt does not reserve or decrement it automatically.
- **Sales & offers:** choose a product, enter a lower sale price and publish. The saved regular price becomes the crossed-out price. Ending the sale restores that regular price. Catalogue, checkout and the sale collection use the same database price. The homepage announcement shows the largest whole-percentage discount among active, in-stock sale products. No sale has been started automatically.
- **Customers:** private registered-customer directory and optional marketing consent. No marketing campaign is sent automatically.
- **Store settings:** assistant availability and customer policies. Online payments remain disabled; checkout uses COD.

## Staff security

`ibreeq.zafar@gmail.com` was granted the administrator role with explicit owner approval on 2026-10-26. No other account was promoted. The co-founder will be added later at the owner's request, once the exact account and approval are available. Never put a service-role key, password or MFA secret into frontend files or this guide.

Role changes are made through a trusted backend operator, not through a customer registration field. If enrolling MFA, the staff member must handle the QR code and secret privately. The dashboard is excluded from indexing and provides no public navigation link to ordinary customers. Knowing its URL does not grant data access.

## Limits

This is a university furniture project with sourced catalogue references and synthetic stock. Confirm image usage permission and actual supplier facts before operating a commercial store. Estimated dimensions remain explicitly identified. There is no connected visitor analytics, automatic courier booking, campaign delivery pipeline, scheduled sale expiry, refunds system or automatic inventory reservation. Existing Google OAuth and SMTP credentials are separate account settings; their earlier credential issues are not resolved by the dashboard.
