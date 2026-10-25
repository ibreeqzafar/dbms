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
