# Design Studio room images

The local n8n image workflow passed public-reference tests on 4 November 2026:

- Groq `qwen/qwen3.8-27b` accepted a clear room photo and rejected a non-room graphic before image editing.
- The official `black-forest-labs/FLUX.2-klein-4B` Hugging Face Space produced a 768 × 768 room design using the room and a selected furniture photo.
- The generated WebP passed the same fixed-host, byte-limit, file-signature and dimension checks used by the prepared backend.

The original Qwen demo rejected its requested GPU duration. The tested FLUX demo worked without an account token. A saved Hugging Face credential is not embedded in, or sent by, this workflow. Free shared GPU capacity can be limited or unavailable; there is no paid fallback.

## Data flow

1. The customer obtains catalogue matches through the existing recommendation endpoint.
2. They select a matched product, upload a room photo and explicitly agree to external AI processing.
3. `studio-images` authenticates the customer and checks the active account, recommendation grant, product, private source image and request limits.
4. The laptop connector leases one job using its existing private connection key and calls the loopback-only n8n renderer.
5. Groq checks room suitability. Rejected photos do not reach FLUX.
6. FLUX receives the room and selected product references. The worker reports its result; the backend validates and copies it into private storage.
7. The customer can fetch only their own unexpired result. The finished image has independent React state and never reads position, scale or rotation from the manual canvas.

The public Space processes temporary copies. Do not submit photographs containing people or private details. ESSYRA results and sources expire after 24 hours; the laptop worker removes expired objects when running. Access expires even if the laptop is offline.

## Activation status — 5 November 2026

The approved migration, private storage bucket and `studio-images` function are installed in Supabase. The laptop image connector is enabled. Live tests passed non-room rejection, owner-only job access, completed-image storage and owner-only image retrieval. These checks verify the pipeline and permissions; generated furniture fidelity still needs visual review and is not guaranteed by the free model.

Vercel is connected to `ibreeqzafar/dbms`, tracking `main`, and the production `VITE_STUDIO_IMAGE_ENABLED=true` flag is saved. The Git-triggered frontend release is being verified. Do not treat the current public website as image-enabled until that release is verified.

## Deployment checklist

Source and deployment components:

- Migration: `supabase/migrations/202611040021_studio_images.sql`.
- Edge function: `supabase/functions/studio-images/index.ts` and its shared imports.
- n8n template: `n8n/essyra-room-image.private.json`; local configured workflow ID `ESSYRAStudioRenderer01`.
- Connector: `local-n8n/studio-worker.mjs`, started alongside `support-worker.mjs`.
- Frontend: `FinishedRoomDesign.tsx`, gated by `VITE_STUDIO_IMAGE_ENABLED`.

Apply the migration and deploy the function only after the owner approves the new private image-processing connection. As with the existing publishable-key endpoints, disable its legacy JWT gateway check only when the in-function customer-session and worker-key checks are deployed together.

Keep `N8N_SUPPORT_WORKER_KEY` server-side. Never put it, a Groq key, a Hugging Face token or private runtime files in GitHub or `VITE_*` variables.

After backend deployment, copy the connector files into the configured laptop folder, add `runtime/studio-enabled.json` containing `{"enabled":true}`, and restart the support connector. Confirm a worker heartbeat before enabling `VITE_STUDIO_IMAGE_ENABLED=true` in Vercel. Verify customer isolation and the complete website flow before release.

One successful image is attached to each existing recommendation grant. Image creation does not debit a second recommendation credit or alter the exact 24-hour guest refill. Rejected/failed image jobs can retry within that grant, with bounded attempts. Registered recommendation access remains unchanged; image request throttles protect the shared service. Timed-out provider requests are never automatically resubmitted.

## Checks

```sh
npm run test:studio
node scripts/studio-workflow-check.mjs
npm run build
```

Private image integration tests use public reference photographs and do not create orders, change payments or send review emails.
