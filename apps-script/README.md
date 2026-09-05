# Apps Script deployment package

Copy `Code.gs`, `Store.gs`, `Chatbot.gs`, `Auth.gs`, `Logs.gs`, and the manifest into one Apps Script project attached to your private spreadsheet. These files share the Apps Script global namespace; do not wrap them in JavaScript modules.

Required Script Properties: `SPREADSHEET_ID`, `OWNER_EMAILS`. `setup()` generates `AUTH_SECRET` if absent. Optional limits: `MAX_LOGIN_EMAILS_PER_DAY` (default 80), `MAX_CHATS_PER_HOUR` (default 500).

Run `setup()`, populate the sheets, then `installTriggers()`. Deploy as a web app executing as the owner, accessible to Anyone. See [full instructions](../docs/setup-guide.md).

Never call setup or maintenance functions through the public API; they are deliberately excluded from the router. Keep all Google authorization tokens and secret properties on the server. An Apps Script project editor is a trusted administrator.
