# Testing and verification

Current authentication is signup verification followed by password login. Use [the current migration/test guide](password-auth-update.md). The OTP-only live scripts describe the former contract and are not acceptance tests for this update.

## Automated checks

`tests/backend.test.cjs` runs the real Apps Script JavaScript in Node's VM. Pure engine tests use fixture records; identity/router tests use an in-memory Sheets/Mail provider. These test behavior and access checks without claiming a deployed Google integration.

Coverage includes the 17 requested question variations, English and Roman Urdu category queries, synonyms, typo tolerance, follow-up prices, explicit topic changes, incorrect-branch isolation, unknown products, branch-specific kitchen stock, inactive products/branches, UAE deal boundaries, missing numeric values, helpful clarification, formula injection escaping and consistency between the preview/backend engines.

Authentication tests exercise single-use codes, expiry, attempt limits, token hashing, server owner checks, disabled users, logout revocation and forbidden API actions.

`tests/browser_test.py` now runs the current JavaScript Playwright tests (`auth-browser.test.cjs` and `consistency.test.cjs`) through the existing test runtime. They exercise the actual frontend against the Apps Script adapter, authenticated routes, account menu, contact mail payloads, caching, and mobile visible-viewport geometry. They do not send real emails.

Run:

```powershell
python scripts/sync-engine.py
node --test tests/backend.test.cjs
python -m pip install --target .tools playwright
python tests/browser_test.py
```

If Node is not installed, the test-only Playwright installation includes a runtime at `.tools/playwright/driver/node.exe` on Windows. No Node runtime is needed by the website itself.

## Real deployment acceptance checks

After connecting Google, verify:

1. A customer and owner each verify signup once, then log in with email/password without another OTP.
2. A separate customer email cannot access the dashboard, even after modifying client storage.
3. Disabling a user or removing an owner email takes effect on the next protected API request.
4. A branch product edit updates `Chatbot_View` and the assistant; quantities and prices remain separate for identical kitchen items in different branches.
5. Future/expired/inactive deals are not publicly displayed. Empty or inactive branches never expose private records.
6. Guest chat is rejected; a successful signed-in chat creates correct `Chat_Logs` entries, including the returned structured response. Login/logout and dashboard visits create expected logs.
7. All contact buttons use your real, verified details. No sample promotion is presented as a real offer.
8. Frontend calls work from your chosen HTTPS static host. Test an unavailable endpoint and confirm an honest error without sample fallback.
9. Test on a physical phone and with keyboard / screen reader navigation. Browser emulation verifies layout but cannot replace device-specific accessibility checks.
10. Review Apps Script quotas, execution errors, triggers, log retention and spreadsheet sharing permissions.

Live Google authorization, email delivery, quotas and hosting behavior require your configured accounts; they cannot be proven by local fixtures.
