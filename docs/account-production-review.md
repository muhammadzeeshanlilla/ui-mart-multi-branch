# Account and production review — 6 September 2026

This is a partial verification report. Real customer/owner sign-ins, private Sheet records, and the public deployment URL are not yet verified in this review. The public URL and two user-approved inbox addresses were requested; neither credentials nor email codes have been supplied. No login email has been sent.

## Verified

- Existing backend and focused tests: 44 passed before changes. After backend fixes, 43 backend/account tests passed (38 existing backend tests and 5 new account tests).
- Local authentication tests cover correct/incorrect/expired OTPs, replay, hashed sessions, customer versus owner roles, logout and token revocation. Additional account tests reject expired sessions, disabled users, forged roles and stale Users-sheet owner roles.
- Live API: five checks passed for anonymous `me`/dashboard rejection, forged-token dashboard rejection and denial of direct `Users` access. This uses the real `/exec` endpoint from a local browser origin; it is not public-host verification.
- Local browser: 40 page/viewport checks passed at 1440, 1024, 768, 430 and 375 pixels. Public views use deliberate preview fixtures; owner records use deliberate mocks. Long question/response strings and forged sessionStorage role were checked. No uncaught JavaScript errors occurred. External assets were excluded from these local layout checks.
- Source review: Users schema has no passwords, OTPs or bearer tokens. OTP hashes/session hashes live in private backend sheets. OWNER_EMAILS and AUTH_SECRET are resolved from backend properties, never sent as frontend configuration. Local chat tests confirm one row per successful request, guest/customer attribution and no auth fields in the saved response.
- Activity logging currently records login, logout and dashboard access. Chat use is recorded separately in Chat_Logs; no duplicate activity logging was added.
- Git review: 4 commits / 132 file versions checked for common credential patterns and sensitive filenames; no matches. Runtime tools, generated results, .env and Apps Script credentials/config files are ignored. This is a scoped scan, not proof that every possible secret format is absent.

## Confirmed bugs fixed locally

1. `apps-script/Logs.gs`: active-deal statistic now excludes inactive branches, matching the public API.
2. `apps-script/Logs.gs`: activity list is read after recording the current dashboard access, so its returned rows/total include that event.
3. `assets/css/dashboard.css`: long unbroken chat questions/responses wrap inside owner records instead of causing horizontal overflow.

Regression coverage is in `tests/account-review.test.cjs` and the dashboard section of `tests/browser_test.py`. The Python executable available in this environment was unusable, so equivalent browser checks ran with the existing Playwright JavaScript test runtime; the modified Python script itself was not executed. No production dependencies or architecture changes were made.

## User actions and remaining verification

Provide the deployed public website URL, the owner email configured in OWNER_EMAILS, and a distinct customer email with accessible inboxes. Codes will be requested individually and the user asked for each code. Keep AUTH_SECRET private.

Real login/code delivery, customer/owner session lifecycles, live role enforcement, Users/Login_Logs/Chat_Logs/Activity_Logs accuracy and duplicates, real dashboard pagination/statistics and comparison with Sheet rows remain pending those sign-ins. Expiry/disabled-user cases passed locally; live time-based expiry and disabling an account are not yet verified. Raw private Sheet contents/extra columns cannot be certified through the public API.

After reviewing the local fixes, copy `Logs.gs` into the existing Apps Script project and use **Deploy → Manage deployments → Edit → New version → Deploy**, retaining the current URL. Publish the dashboard CSS through the existing static-host process. Neither was deployed by this review. Final live verification must use the supplied production URL and authenticated sessions, including assets, links, CORS, console/network errors, and responsive views with real records.
