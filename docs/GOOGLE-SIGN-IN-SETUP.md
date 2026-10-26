# Enable Google sign-in for ESSYRA

1. Sign in to https://console.cloud.google.com/ and create or select your ESSYRA project.
2. Open Google Auth Platform. Complete Branding with app name ESSYRA and your support/contact email. Choose External audience. For a university demonstration, keep the app in Testing and add the Google accounts that will test it under Audience > Test users.
3. Under Data Access use only the basic sign-in scopes: openid, email and profile.
4. Open Clients > Create client and choose Web application.
5. Add this exact Authorized JavaScript origin:

   https://essyra-home.vercel.app

6. Add this exact Authorized redirect URI:

   https://zhehksxuzyxnurmhwylw.supabase.co/auth/v1/callback

7. Create the client. Copy its Client ID and Client Secret directly into Supabase > Authentication > Sign In / Providers > Google. Enable Google and save. Never paste the secret into chat, frontend code or Git.
8. Keep the Supabase Site URL as https://essyra-home.vercel.app and the existing allowed /account callback. Reply "Google configured" after saving; the frontend Google button can then be enabled and tested.

Testing mode permits only the test accounts you add. Do not request Gmail, Drive or other unrelated scopes.

Official guide: https://supabase.com/docs/guides/auth/social-login/auth-google

## Activation status

Google provider availability was confirmed through Supabase public Auth settings on 25 October 2026. The production frontend enables Continue with Google. OAuth returns through /account and restores a validated local destination for checkout and the embedded designer. Client secrets remain exclusively in Supabase settings. A successful customer Google login still needs to be verified in the browser.

## Account-page diagnostics — 26 October 2026

Account loading now waits for Auth SDK initialization and server-verified user/profile loading before showing the login form. OAuth errors in either query parameters or fragments are captured before the SDK consumes them and displayed without reflecting provider secrets or authorization codes. Profile-loading failures provide a retry action. Ordinary Google sign-in no longer leaves an unnecessary homepage return flag; explicit checkout and designer return destinations remain validated local paths. A signed-in browser session alone is not proof of a fresh Google login. Repeat the customer Google sign-in and verify the callback after publishing.

## Confirmed provider failure — 26 October 2026

Supabase Auth logs report Google oauth2 invalid_client: The provided client secret is invalid. The Google Cloud ESSYRA Website client ID matches Supabase, and its origin and callback URLs match the website and Supabase callback. Replace the secret directly in the secure Google/Supabase settings; never copy it into chat, source, or diagnostics. A fresh Google sign-in must be retested after replacement.

Email provider and new-user signups are enabled, and confirmation is not required. These settings alone do not prove a successful customer registration or validate any supplied password. The exact email/password error is still needed for account-specific diagnosis. No password was changed and no new recovery email was sent during this audit.
