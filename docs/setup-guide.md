# Setup and deployment

## 1. Review the local preview

Run `python -m http.server 8080 --bind 127.0.0.1` from the project root. Open `http://localhost:8080`. Check all three branch pages, promotions and the assistant. The preview contains sample prices and deals and cannot sign anyone in. No real business records are bundled.

## 2. Create the Google backend

1. Create a new private Google Spreadsheet. Copy its ID from the URL between `/d/` and `/edit`.
2. Open Extensions → Apps Script. Add each `.gs` file from `apps-script/` with the matching name, replacing the default empty `Code.gs`.
3. In Project Settings, enable the manifest file in the editor. Replace `appsscript.json` with the supplied manifest. It uses the UAE timezone.
4. In Project Settings → Script Properties, add `SPREADSHEET_ID` with your spreadsheet ID and `OWNER_EMAILS` with your own verified email address (or a comma-separated list of owners).
5. Select and run `setup()`. Approve the requested spreadsheet, send-mail and trigger permissions in your Google account. This creates the tabs, seeds branch names only, and creates a server-side `AUTH_SECRET`.
6. Fill `Branches`, the three product tabs and `Deals`, following [the schema](google-sheet-structure.md). Do not paste passwords or sign-in tokens into any tab.
7. Run `syncChatbotView()` once and inspect the consolidated result. Run `installTriggers()` to enable manual-edit, five-minute synchronization and daily authentication cleanup triggers.

Setup does not import preview products or promotions. Use your actual business records. Only trusted administrators should have access to the spreadsheet or script project.

## 3. Publish the API

Choose Deploy → New deployment → Web app. Execute as **Me**, and allow access to **Anyone**. The API validates owner access itself; the spreadsheet remains private. Copy the production URL ending in `/exec`. Opening it should return a small service-status JSON object.

If your Workspace administrator disallows anonymous web apps, this static frontend integration cannot work as configured; use an account/deployment policy that permits it or replace the API hosting layer. Do not publish the spreadsheet as a workaround.

In `assets/js/config.js` set:

```js
export const config = Object.freeze({
  apiUrl: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
  preview: false,
  timeoutMs: 25000,
});
```

The endpoint URL is public configuration. The owner list, secret, email codes and session hashes stay on the backend. Do not reuse another website’s endpoint.

Apps Script Content Service redirects JSON responses; the API client follows redirects. The existing JSON body with `Content-Type: text/plain;charset=utf-8` is retained to avoid a JSON preflight. Do not change to `mode: no-cors`, because that prevents reading responses.

Official platform references: [web app deployment](https://developers.google.com/apps-script/guides/web), [Content Service](https://developers.google.com/apps-script/guides/content), [Script Properties](https://developers.google.com/apps-script/guides/properties), [MailApp](https://developers.google.com/apps-script/reference/mail/mail-app).

## 4. Verify real authentication and permissions

- Request a code using the configured owner email. Check inbox/spam. Enter the 8-digit code within 10 minutes. Successful owner sign-in opens the dashboard.
- Sign out, then verify that the previous token no longer works. A fresh code is required for a new sign-in.
- Sign in with a different email as a customer. Try opening `pages/owner-dashboard.html`: it must refuse access. Editing browser storage or the `Users.role` cell must not grant ownership.
- Confirm `Users`, `Login_Logs`, `Chat_Logs` and `Activity_Logs` contain the expected records.
- Disable a test customer in the Users sheet and confirm the existing session cannot call protected APIs.

Codes permit five attempts and expire after ten minutes. A code can be sent at most once per email per minute and five times per hour. Default global send ceiling is 80/day, further constrained by your Google account’s MailApp quota. Sessions expire after eight hours; browser tokens live in sessionStorage, not persistent localStorage. Closing a tab does not create a false logout log. The site requires HTTPS for deployment.

Optional Script Properties: `MAX_LOGIN_EMAILS_PER_DAY` and `MAX_CHATS_PER_HOUR`. Set them to positive integers appropriate to your account. Public APIs on Apps Script have limited abuse controls and are intended for modest traffic; global ceilings protect quota at the cost of temporary service unavailability if exceeded.

## 5. Publish the frontend

Create an empty GitHub repository and push the existing local `main` branch. Do not add a second generated README when creating the remote.

```powershell
git remote add origin https://github.com/YOUR-USERNAME/ui-mart-multi-branch.git
git push -u origin main
```

Choose any static host:

- GitHub Pages: deploy `main`, repository root. Relative URLs support `/ui-mart-multi-branch/` project hosting.
- Netlify: import repository, leave build command blank, publish directory `.`.
- Vercel: use the Other/static preset, no build command, output directory `.`.

There is no frontend server or rewrite requirement. Use the deployed HTTPS website to repeat the live checklist in [testing.md](testing.md). Replace the illustrative image URLs with your approved photography if desired; the layout has background colors if remote images cannot load.

## Updating and troubleshooting

After changing Apps Script, use Deploy → Manage deployments → Edit → New version → Deploy to preserve the configured URL. Saving script files alone does not update an existing production version.

If requests fail, inspect Apps Script Executions, validate properties, run setup, verify deployment access and ensure the URL ends in `/exec` rather than `/dev`. If code delivery fails, inspect send-mail quota and authorization, wait for cooldown, and request a new code. If products do not synchronize, inspect invalid source rows and trigger failures; run `syncChatbotView()` manually after correcting data.

If login succeeded on the server but a network interruption prevented the browser receiving the token, request a fresh code. Codes are intentionally single use. If a session expires, sign in again. Never disclose secret properties in support screenshots or Git commits.

## Remaining account-specific actions

Local code is complete; you must create the actual spreadsheet, approve Google scopes, populate real data and contact details, deploy the web app, configure its URL, create the GitHub repository and select a static host. Those steps cannot be completed without your accounts. No external website has been published by this local setup.
