# Apps Script deployment package

Copy `Code.gs`, `Store.gs`, `Chatbot.gs`, `Auth.gs`, `Logs.gs`, `AIChatbot.gs`, `AITools.gs`, `AIProvider.gs`, `AIMemory.gs`, and the manifest into one Apps Script project attached to your private spreadsheet. These files share the Apps Script global namespace; do not wrap them in JavaScript modules.

Required Script Properties: `SPREADSHEET_ID`, `OWNER_EMAILS`. `setup()` generates `AUTH_SECRET` if absent. Optional limits: `MAX_LOGIN_EMAILS_PER_DAY` (default 80), `MAX_CHATS_PER_HOUR` (default 500).

The authenticated AI assistant additionally requires `AI_PROVIDER`, `AI_API_URL`, `AI_API_KEY`, and `AI_MODEL`. The provider must be `openai` or `openai-compatible`, and the URL must be an HTTPS chat-completions-compatible endpoint. Optional AI limits are `MAX_AI_REQUESTS_PER_MINUTE` (default 12) and `MAX_AI_REQUESTS_PER_HOUR` (default 200). Keep every value in Script Properties; never place provider secrets in frontend files or Sheets.

Run `setup()`, populate the sheets, then `installTriggers()`. For an existing sheet, run `migrateAIChatbot()` once to append the AI log metadata columns. Deploy as a web app executing as the owner, accessible to Anyone. See [full instructions](../docs/setup-guide.md).

Never call setup or maintenance functions through the public API; they are deliberately excluded from the router. Keep all Google authorization tokens and secret properties on the server. An Apps Script project editor is a trusted administrator.
