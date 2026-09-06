# U&I Mart Multi-Branch Website

A responsive company website with three specialized branch experiences, a main-site customer assistant, Google Sheets / Apps Script backend, email-verified signup and password login and a private owner monitoring dashboard.

The original project is preserved in its separate folder. This project is independent and contains no dependency on its files or backend URL.

## Run locally

From this folder, run:

```powershell
python -m http.server 8080 --bind 127.0.0.1
```

Open **http://localhost:8080**. Use an HTTP server instead of double-clicking HTML files: JavaScript modules require HTTP. No application dependencies, package install or build step is required.

The live configuration uses authenticated data access. Follow [the password-auth migration and deployment guide](docs/password-auth-update.md) for the current signup/login contract. Previous OTP-only accounts complete Sign Up once to set a password.

## Features

- Main company site and dedicated Abu Dhabi, Dubai and Sharjah pages, using one responsive design system with four color themes.
- Company introductions, category descriptions, branch services, deals, contact information, locations and opening hours. Missing contact details are honestly marked as unpublished.
- Main-site assistant with English / Roman Urdu phrase handling, synonyms, one-edit typo tolerance, branch-aware product matching, basic follow-up context and structured product / deal / contact responses.
- Product details appear only in assistant conversations. Prices use AED. Public branch pages have no inventory listing.
- Public promotions filter by branch, active status and inclusive UAE dates.
- Email-verified registration and password sign-in, hashed codes and session tokens, expiry, rate limits, logout revocation, and owner permissions verified by the backend.
- Owner monitoring of users, login records, conversation questions and full replies, activity logs, deals and branch information, with 25-record pagination.
- Spreadsheet setup and synchronization functions, separate named-record data adapter, consistent API, and static-host-compatible frontend.

## Project layout

```text
index.html                      Main company site; the only page with a chatbot
pages/                          Three branches, deals, contact, login, dashboard
assets/css/                     Shared design system, reused/refined chat UI, dashboard
assets/js/                      Page rendering, API, auth, chat, dashboard, preview
apps-script/                    Deployable Google Apps Script backend
  Code.gs                       API routing, validation, chat orchestration
  Store.gs                      Schema, Sheets adapter, sync, setup, triggers
  Chatbot.gs                    Pure intent/search/response engine
  Auth.gs                       Signup verification, password login, sessions
  PasswordCrypto.gs             Server-only PBKDF2 primitives
  Logs.gs                       Activity logging and owner dashboard reads
  appsscript.json                Runtime, timezone and scopes
docs/                           Setup, schema, architecture, testing and provenance
scripts/sync-engine.py           Update the browser copy of the assistant engine
tests/                          Backend/security and real-browser tests
```

## Connect Google Sheets

1. Create **one private spreadsheet**, then open **Extensions → Apps Script**.
2. Add all six `.gs` files and the `appsscript.json` manifest from `apps-script/`.
3. Set Script Properties `SPREADSHEET_ID` and `OWNER_EMAILS` (comma-separated owner email addresses). Never put these or the generated `AUTH_SECRET` in frontend JavaScript.
4. Run `setup()` and authorize access. It creates all required tabs and three branch records, without inventing business stock or contact information.
5. Fill branch information, product records and promotions using [the schema guide](docs/google-sheet-structure.md). Run `installTriggers()`.
6. Deploy a web app executing as you, accessible to **Anyone**. Keep the actual spreadsheet private. Copy the production `/exec` URL.
7. In `assets/js/config.js`, set `apiUrl` to that URL and `preview: false`.

Follow [the full deployment and verification steps](docs/setup-guide.md) before sharing the live URL. Real email delivery and Google account permissions must be verified in your account.

## Reused code

The original chat launcher / panel markup, CSS layout, typing animation, safe text rendering, product cards, quick actions, scroll behavior, loading state and error recovery were retained and cleaned up. The API retains the existing JSON-in-`text/plain` POST pattern, redirect following and timeout handling. Session IDs remain per browser tab. Existing split hero, image overlays, manual slide indexing, branch cards and responsive navigation informed the new shared layout.

All old branding, store-specific content, colors, names, currency, delivery rules and API URL were removed from the new implementation. The old logo and store photographs were not copied. Marketing photographs are illustrative remote Unsplash images, not photographs of the real branches; they can be replaced with your approved images.

## Test

With Node.js installed:

```powershell
node --test tests/backend.test.cjs tests/account-review.test.cjs tests/password-auth.test.cjs
```

For browser tests on Windows with Microsoft Edge installed:

```powershell
python -m pip install --target .tools playwright
python tests/browser_test.py
```

The browser tests serve local assets through Playwright routes and emulate Google services; they do not start a production backend. Playwright, screenshots and temporary test outputs are ignored by Git. See [test coverage and live verification](docs/testing.md).

When changing the assistant engine, edit `apps-script/Chatbot.gs`, run `python scripts/sync-engine.py`, then rerun tests and redeploy Apps Script.

## GitHub and frontend deployment

The new folder is its own Git repository. Create an empty GitHub repository, then run from here:

```powershell
git remote add origin https://github.com/YOUR-USERNAME/ui-mart-multi-branch.git
git push -u origin main
```

For **GitHub Pages**, choose Settings → Pages → Deploy from a branch → `main` → `/ (root)`. Relative links support repository subpaths. For **Netlify** or **Vercel**, import the repository as a plain static website: no build command, publish/output directory `.`. No single-page rewrite is needed. Use HTTPS. Configure the live API before publishing, or intentionally keep the labelled preview for demonstrations.

Do not publish the private spreadsheet or share edit access with customers. `apiUrl` is a public endpoint, not a secret; all private actions are authorized on the server.

## Architecture and limitations

Frontend → API contract → Apps Script domain services → Sheets adapter. A future SQL-backed service can preserve the same action/response contract and replace `DataService` and authentication without redesigning pages. No SQL database is installed in this phase. See [architecture](docs/architecture.md).

This is a company information and support application. Inventory is maintained in Sheets. There is no payment, order or transaction functionality.

The assistant is a maintainable rule-and-data engine, not an LLM. It supports English and common Roman Urdu phrases, not arbitrary multilingual understanding. Follow-up context lasts while the current page is open. Results are bounded; customers may need to narrow questions. Sheets is suitable for modest traffic: requests use a script lock, and dashboard reads scan source tabs before paginating. Google quotas, synchronization delay, email limits and log growth require owner monitoring. A failed network response after a saved chat or sent code can lead to a retry; there is no distributed exactly-once request processing.

The owner dashboard is for monitoring, not editing. Update products, promotions, branches and user status directly in the private spreadsheet. Owner privileges come only from the server-side `OWNER_EMAILS` property.
