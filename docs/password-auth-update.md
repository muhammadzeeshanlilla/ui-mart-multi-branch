# Signup, password login, contact and viewport update

## Implementation and security

The existing `requestCode`/`verifyCode` actions now verify **signup only**, including one-time password setup for OTP-only accounts. Verification returns no session. Normal `login` uses email/password, updates `last_login`, and uses the existing hashed session storage and login/activity logs. `name` continues to store the full name; no duplicate `full_name` column is needed. Existing accounts retain their user ID, creation date and history. Email comparison is normalized; duplicate normalized existing emails fail closed instead of silently creating another user.

Passwords are hashed only in Apps Script with **PBKDF2-HMAC-SHA256, 600,000 iterations, unique salts and 256-bit output**. Passwords must contain 15–128 characters and are not trimmed. Pending signup stores only the derived hash/salt and hashed OTP in `_AuthCodes`; successful verification clears pending credential fields. No plaintext passwords/OTPs are written to Sheets or application logs. `me`, login and dashboard responses explicitly exclude password fields. Owner authorization remains based on server-only OWNER_EMAILS. Signup cannot overwrite a password-bearing account. Forgot Password is deliberately not introduced in this update; signup is not a password-reset shortcut.

`PasswordCrypto.gs` vendors only the SJCL 1.0.8 SHA256/HMAC/PBKDF2 and bit-array/encoding primitives, with the BSD license retained in `crypto-license.txt`. No SJCL ECC, encryption, PRNG, cached password function, browser crypto or network dependency is used. Sources: https://github.com/bitwiseshiftleft/sjcl/tree/1.0.8/core . Work factor reference: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html . The local full-work-factor implementation matches Node crypto's PBKDF2 output, including Unicode input. A local hash took about 4 seconds; Apps Script execution time remains a required deployment measurement. Hashing is not weakened to hide latency; signup/login requests allow 120 seconds in the frontend.

All data actions (`branches`, `deals`, `chat`, `contact`, `dashboard`, `me`) require a valid backend session. First-time visitors see Sign Up; a device-local returning-user preference selects the Login tab only and grants no access. Each normal page validates `me` before showing content. Invalid/revoked/legacy sessions return `AUTH_REQUIRED`, clear client authentication/cache, and route back to the same deployment's login page. Old OTP-only users, including the owner, must complete Sign Up once. Existing legacy sessions cannot bypass password setup.

GitHub Pages serves static HTML/JS publicly: it cannot make downloadable static files confidential. The experience is gated without flashing the normal page, and the actual data/API is protected server-side. No authorization decision is cached. Static editorial assets remain downloadable by design of this hosting architecture.

## Contact

Subject (1–150 characters) and message (1–4000 characters) are validated server-side. Identity comes from the authenticated user. The backend chooses recipients from OWNER_EMAILS and uses the verified customer email as Reply-To, never From. Client recipient/identity fields are ignored. Limits are 3 messages per user per 10 minutes and 50 total/day. CONTACT records log the action without copying the message into Activity_Logs. Mail uses plain text, and internal errors are not exposed.

## Performance

Previously `main.js` awaited `branches` before constructing the entire page; deals loaded afterward. The authenticated page shell now renders independently of branch/deal requests. These requests run concurrently and are deduplicated within a document. Shared branch/deal responses are cached in sessionStorage for two minutes, rendered immediately when fresh, and refreshed asynchronously; logout/invalid sessions clear them. Product prices/stock, private records, passwords and authorization decisions are not cached. Cached deals are checked against inclusive UAE date boundaries before display. A backend session-validation round trip still precedes protected content on each page, as required; this is not a promise of zero network latency.

## Mobile chatbot

At widths up to 480px, an open panel follows visualViewport height and offset (with innerHeight fallback). Its header/composer retain their flex sizes while only the message area scrolls. Body scroll position is saved/locked/restored; input focus uses preventScroll. Resize and visual-viewport scroll events recompute the panel position so the composer stays in the visible area above the keyboard. Desktop sizing is unchanged. Tests cover 430/390/375/360px, 330px reduced height and a shifted visual viewport. A physical Android keyboard still needs manual verification; emulation cannot prove every browser/IME combination.

## Deploy in this order

1. Copy updated **Auth.gs, Code.gs, Logs.gs, Store.gs**, and add new **PasswordCrypto.gs** to the existing Apps Script project. Leave Chatbot.gs and the manifest unchanged.
2. Run **migratePasswordAuth()** once. It only appends missing columns to existing Users and _AuthCodes headers; it preserves records. Do not recreate the spreadsheet or run setup to replace data. For a completely new Sheet, setup already includes the new schema.
3. **Deploy → Manage deployments → Edit → New version → Deploy**, retaining the same `/exec` URL.
4. Push the frontend changes through the existing GitHub Pages deployment. Coordinate these steps: the older OTP frontend cannot use the new password API. No deployment or Git push was performed here.
5. On the published site, existing customer and owner each choose Sign Up once, use their existing email and a new private password, verify the emailed signup OTP, then log in using that password. Never send passwords or AUTH_SECRET to the assistant.
6. Verify real signup email delivery, owner setup, password logins, session revocation, contact email delivery/Reply-To, Apps Script execution latency and Android keyboard behavior. These require the new deployment and user inbox/device access.

Added columns:

| Sheet | Columns |
|---|---|
| Users | email_verified, last_login, password_hash, password_salt, password_iterations |
| _AuthCodes | purpose, name, password_hash, password_salt, password_iterations |

## Tests

Run `.tools/playwright/driver/node.exe --test tests/backend.test.cjs tests/account-review.test.cjs tests/consistency.test.cjs tests/password-auth.test.cjs tests/auth-browser.test.cjs` using the existing test-only runtime. No Node production backend is introduced. `auth-fixture.cjs` emulates Google services; browser tests run the actual new frontend against the actual Apps Script functions using this adapter. Mail is captured locally, not delivered. The old OTP-only live scripts are historical and must not be used as acceptance tests for this contract.

All **51 local regression tests passed**, including signup/customer/owner/permissions/contact/hash/date/product/viewport checks. Live acceptance remains **NOT TESTABLE WITHOUT USER ACTION** until the new source is deployed; previous live OTP-login results do not certify this new flow.
