# Design Studio agent

ESSYRA uses two separate n8n workflows: ESSYRA Care for shopping/support, and ESSYRA Design Studio for styling and placement advice. Both currently use Groq's `openai/gpt-oss-20b`, separate conversation memory, and bounded read-only public catalogue tools. Provider quotas are shared.

The studio first calls the authenticated `recommendations` function. PostgreSQL records successful generations and enforces guest access. Server filtering checks budget, quantity, stock and supplied measurements. After results appear, **Ask Design Studio** sends room type, budget, quantity and at most three eligible product slugs through the existing owner-isolated support queue. The outbound laptop connector routes the studio marker to the second local-only webhook. The adviser explains these choices; **Try** selects an already matched product for the browser canvas.

No photos, account email, delivery address, access token or private order rows are added to the model prompt by this integration. A customer can still type personal information in support chat; the privacy notice advises against doing so. Generated advice is untrusted text rendered by the existing restricted-link formatter, never HTML. Tool endpoints and fields are fixed; models cannot select arbitrary URLs or SQL. Choosing the studio route confers no additional privilege.

Image processing is separate: the browser's existing cutout tools remove a furniture background and offer crop/adjustment controls. Users place, scale and rotate the resulting illustrative overlay. This Groq text model does not analyse room photos, generate images, infer accurate dimensions or promise physical fit.

The website uses the already installed support gateway and queue; no new privileged database migration is needed. Both services must be running on the laptop. Start `local-n8n/Start ESSYRA Support.cmd` after a restart; allow n8n to finish starting. Free-tier limits and network outages can prevent answers; timed requests display an error and retain the matched products.

Portable workflow JSON in `n8n/` contains no saved provider credentials. On a fresh installation, import each workflow and select a Groq credential in its model node before publishing. Existing installations preserve their own credential references. Never upload `runtime/`, credential exports, encryption configuration or bridge keys.
