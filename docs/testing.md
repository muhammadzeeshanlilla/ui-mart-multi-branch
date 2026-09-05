# Testing and verification

## Automated checks

`tests/backend.test.cjs` runs the real Apps Script JavaScript in Node's VM. Pure engine tests use fixture records; identity/router tests use an in-memory Sheets/Mail provider. These test behavior and access checks without claiming a deployed Google integration.

Coverage includes the 17 requested question variations, English and Roman Urdu category queries, synonyms, typo tolerance, follow-up prices, explicit topic changes, incorrect-branch isolation, unknown products, branch-specific kitchen stock, inactive products/branches, UAE deal boundaries, missing numeric values, helpful clarification, formula injection escaping and consistency between the preview/backend engines.

Authentication tests exercise single-use codes, expiry, attempt limits, token hashing, server owner checks, disabled users, logout revocation and forbidden API actions.

`tests/browser_test.py` launches real headless Microsoft Edge and its own local server. It checks all eight pages at 1440, 768, 390 and 320 pixels, horizontal overflow, headings, mobile navigation, assistant presence only on the main page, chat product rendering, AED formatting, follow-ups, filters, deep linking and failed-request recovery. Intercepted API responses additionally verify the login → dashboard → logout UI contract; these are explicitly mocked, not Google account tests. Screenshots are written to the ignored `test-results/` directory.

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

1. An actual owner email receives a code; code reuse and wrong/expired codes fail.
2. A separate customer email cannot access the dashboard, even after modifying client storage.
3. Disabling a user or removing an owner email takes effect on the next protected API request.
4. A branch product edit updates `Chatbot_View` and the assistant; quantities and prices remain separate for identical kitchen items in different branches.
5. Future/expired/inactive deals are not publicly displayed. Empty or inactive branches never expose private records.
6. A successful guest chat and signed-in chat create correct `Chat_Logs` entries, including the returned structured response. Login/logout and dashboard visits create expected logs.
7. All contact buttons use your real, verified details. No sample promotion is presented as a real offer.
8. Frontend calls work from your chosen HTTPS static host. Test an unavailable endpoint and confirm an honest error without sample fallback.
9. Test on a physical phone and with keyboard / screen reader navigation. Browser emulation verifies layout but cannot replace device-specific accessibility checks.
10. Review Apps Script quotas, execution errors, triggers, log retention and spreadsheet sharing permissions.

Live Google authorization, email delivery, quotas and hosting behavior require your configured accounts; they cannot be proven by local fixtures.
