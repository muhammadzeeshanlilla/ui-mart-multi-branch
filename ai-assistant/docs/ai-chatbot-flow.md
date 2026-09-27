# AI assistant flow

1. `boot.js` validates the existing backend session before importing the Home-page AI module.
2. `ai-chatbot.js` sends a bounded message, conversation ID, and one-time request ID through the existing authenticated API client.
3. `Code.gs` authenticates the token before routing to `aiChat_`.
4. `AITools.gs` retrieves active products, deals, and branches from Google Sheets and returns a small trusted result set.
5. `AIMemory.gs` supplies only recent, user-scoped conversation context.
6. `AIProvider.gs` calls the administrator-configured provider from Apps Script. Secrets never reach the browser.
7. `AIChatbot.gs` logs the exchange with `chatbot_type = ai_assistant` and returns the response plus trusted result cards.

The public Login-page Rule-Based chatbot continues to use the separate `chat` action and `Chatbot.gs` engine.
