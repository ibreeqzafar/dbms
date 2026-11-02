# ESSYRA local n8n

This is free self-hosted n8n Community Edition. It does not depend on the n8n Cloud trial. AI model quotas or charges are separate.

1. Double-click **Start ESSYRA n8n.cmd**.
2. Open http://localhost:5678 in your browser.
3. Complete the local owner-account setup yourself; use your own password and keep it private.
4. Double-click **Stop ESSYRA n8n.cmd** when finished.

The process starts with a hidden window. It does not start automatically when Windows starts, and this setup does not change Windows sleep settings. While it is running, the laptop must stay awake and connected for any later website integration to work.

The editor listens only on 127.0.0.1. The prepared website connector makes outbound HTTPS requests to a private Supabase queue; no public tunnel or public editor is needed. It remains inactive until the queue/functions are deployed and its separate connection key is saved in Supabase.

After activation, use **Start ESSYRA Support.cmd** to start n8n and its website connector in the background. You can close the startup window and browser editor. Keep the laptop awake and online. **Stop ESSYRA n8n.cmd** stops both processes after checking their saved process identities. After restarting Windows, run **Start ESSYRA Support.cmd** again; no Windows auto-start or sleep settings are changed.

For the connection key, run **Copy ESSYRA Bridge Key.cmd** yourself and paste its value directly into Supabase Edge Function secrets as `N8N_SUPPORT_WORKER_KEY`. This creates a random key on first use and stores it with Windows user encryption. Do not paste it into chat or source files. The assistant does not need its value. Full activation and security details are in the website source's `SUPPORT-AGENT-SETUP.md`.

The CMD helper runs Node and ordinary built-in Windows encryption/clipboard commands. It does not load a PowerShell script file or change Windows execution policy. The older **Set ESSYRA Bridge Key.cmd** shortcut now opens the same copy helper.

## Private data and backups

`runtime/` contains n8n's SQLite database, encryption configuration, logs and process record. Never commit, upload publicly or share this folder. Do not delete or lose the encryption configuration: saved provider credentials need it. For a consistent backup, stop n8n first and copy the whole runtime folder to your own private backup location. Keep the backup private as well.

Workflow JSON files without private credentials can be exported separately for portability. The existing prepared shopping/support workflow is in the website source's `n8n/` folder. Do not insert secret API keys into workflow parameters; use n8n credentials.

The account on this local installation is separate from your n8n Cloud account. Keep n8n updated, checking compatibility before an update and backing up runtime first. A local SQLite installation is suitable for your single-laptop project demonstration; it is not an always-available hosted service.

## Windows compatibility

This setup pins n8n 2.45.4. Its node loader does not escape apostrophes in Windows folder names. `compatibility.mjs` applies a narrow local fix using JSON string escaping before launch, preserving the installed original beside the file. It fails safely if an upgrade changes that loader unexpectedly; review the fix when updating. No authentication or permissions are bypassed.
