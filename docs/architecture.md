# Architecture and API contract

The eight HTML entry points load small JavaScript modules. `main.js` composes shared company sections. `chatbot.js` exists only on `index.html`. Branch, deals, contact, login and owner pages link back to the main assistant. No public product-list endpoint exists.

```text
Static pages → assets/js/api.js → Apps Script Code.gs
                                    ├─ Chatbot.gs (intent/search/response)
                                    ├─ Auth.gs (identity and permissions)
                                    ├─ Logs.gs (monitoring)
                                    └─ Store.gs / DataService → one private spreadsheet
```

`config.js` is the only API configuration location. Preview mode dynamically imports `preview.js`; live mode does not load sample records. The preview engine is generated from the same canonical `apps-script/Chatbot.gs`, so testable intent behavior is shared. The public source code does not include live inventory.

## Requests

POST JSON as `text/plain;charset=utf-8`. Every request has `action` and a per-tab `session_id`. An authenticated request carries `token` in the body, never the URL. The client cannot choose its user ID or role. Maximum raw request length: 12,000 characters; chat message: 1–500 characters.

| Action | Additional inputs | Result | Access |
| --- | --- | --- | --- |
| `branches` | None | `branches` | Public |
| `deals` | None | `deals` | Public, active promotions only |
| `chat` | `message`, optional `context` | Structured assistant response | Guest or signed in |
| `requestCode` | `email` | Confirmation message, never the code | Rate limited |
| `verifyCode` | `email`, `code`, optional `name` | `token`, `expires_at`, safe `user` | Valid single-use code |
| `me` | `token` | Safe `user` | Active session |
| `logout` | `token` | Success; session revoked | Active session |
| `dashboard` | `token`, `tab`, `offset` | `rows`, `total`, `limit`, `offset`, `summary` | Server-verified owner |

All responses include `success`. Errors are `{ "success": false, "message": "…" }`; Apps Script Content Service uses application-level status rather than custom HTTP error status. The frontend rejects malformed/unsuccessful responses. It does not silently fall back to sample data when live requests fail.

```json
{
  "success": true,
  "reply": "Furniture is a specialty of Dubai branch. Here is a matching product…",
  "intent": "PRODUCT_SEARCH",
  "branch": "Dubai",
  "category": "Furniture",
  "products": [],
  "deals": [],
  "contact": null,
  "contacts": [],
  "context": {"branch": "Dubai", "category": "Furniture"}
}
```

A product uses `product_id`, `name`, `category`, `branch`, `description`, `price`, `quantity`, `stock_status`, `brand`, and `unit`. Unknown numeric data is null. Contacts use `branch`, `phone`, `whatsapp`, `maps_url`. Product/deal counts are bounded to avoid a catalogue-style dump. Refining a question retrieves more relevant results.

## Assistant behavior

Normalize case/punctuation → infer intent → identify product/category/branch using synonyms and minor typo tolerance → apply branch and active filters → query consolidated records → generate a reply → append a structured chat log. Basic follow-ups carry category/branch/product context. An explicit new product changes scope. Missing stock information is not treated as unavailable.

Branch specialization is business configuration, not an assertion that every possible product is currently stocked. All three branches offer kitchen items but maintain separate records. General marketing copy is static; precise contacts, inventory and active promotions come from Sheets.

## Access and persistence

The owner email allowlist is stored in Script Properties. Every protected action looks up the session hash, expiry, revocation state and active user, then recomputes their role from that list. Codes are hashed with a server secret and expire after ten minutes / five attempts. Tokens are hashed at rest, expire in eight hours and are revoked at logout. Browser storage is a bearer-token boundary: HTTPS and safe text rendering are required; do not add untrusted scripts.

Writes and authentication are serialized with a script lock. User text is escaped against spreadsheet formula injection. Private data renders through textContent, not HTML. HTTPS link checks prevent script URLs. Rate limits include global persistent ceilings; per-chat session throttling is supplemental and is not identity verification.

Daily cleanup removes expired auth rows and rate counters. Business logs are append-only from the application; the owner controls archival. A guest can change session ID; guest IDs group conversations, not prove identity. The request contract allows basic follow-up context but never trusts it for authorization.

## Future migration

Implement the same action contract behind a replacement API. Replace `DataService.getProducts`, `getDeals`, `getBranches`, `saveChatLog`, `saveLoginLog` and `saveActivityLog` with another storage adapter; move authentication and dashboard reads to matching service implementations. Keep the pure assistant engine and frontend response shapes. Only the API transport/configuration should need adjustment if the new server uses standard JSON headers or cookies.

No future commerce modules or SQL dependencies are included now. A higher-traffic deployment would need indexed queries, stronger anti-abuse controls, managed identity and bounded retention rather than large sheet scans.
