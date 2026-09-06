# One spreadsheet, separate responsibilities

Run `setup()` in the Apps Script editor to create these tabs and header rows. It is safe to rerun on a correctly configured spreadsheet: it does not overwrite existing source records. If existing headers do not include every required field, setup stops with a schema error. Add missing columns rather than renaming business data blindly.

Columns are matched by name, so source columns may be reordered. Keep header spelling exact. Treat row 1 as the header. Set boolean cells to TRUE or FALSE (checkboxes work). Blank `is_active` means inactive. Keep IDs stable and unique within each branch; prefix IDs by branch to make deal references unambiguous.

| Tab | Columns |
| --- | --- |
| `AbuDhabi_Products` | `product_id`, `product_name`, `category`, `description`, `price`, `quantity`, `brand`, `unit`, `keywords`, `is_active` |
| `Dubai_Products` | Same product columns |
| `Sharjah_Products` | Same product columns |
| `Chatbot_View` | `product_id`, `product_name`, `category`, `branch`, `description`, `price`, `quantity`, `stock_status`, `brand`, `unit`, `keywords`, `is_active` |
| `Deals` | `deal_id`, `title`, `branch`, `category`, `product_id`, `description`, `discount_type`, `discount_value`, `free_item`, `start_date`, `end_date`, `image_url`, `is_active` |
| `Branches` | `branch_id`, `branch_name`, `city`, `specialization`, `address`, `phone`, `whatsapp`, `email`, `map_url`, `opening_hours`, `description`, `is_active` |
| `Users` | `user_id`, `name`, `email`, `role`, `status`, `created_at` |
| `Login_Logs` | `log_id`, `user_id`, `user_email`, `login_time`, `logout_time`, `status`, `session_id` |
| `Chat_Logs` | `chat_id`, `session_id`, `user_id`, `user_name`, `user_message`, `bot_response`, `detected_intent`, `detected_branch`, `detected_category`, `detected_product`, `timestamp` |
| `Activity_Logs` | `activity_id`, `user_id`, `session_id`, `action`, `description`, `timestamp` |
| `_AuthCodes` | `email`, `code_hash`, `expires_at`, `attempts`, `sent_at` |
| `_Sessions` | `token_hash`, `user_id`, `session_id`, `expires_at`, `revoked` |

The last two tabs are internal and hidden for tidiness. Hiding tabs is **not** access control: the entire spreadsheet must remain private. Passwords and plaintext sign-in codes are never stored. `_AuthCodes` holds keyed code hashes; `_Sessions` holds keyed bearer-token hashes.

## Product rules

| Branch | Allowed categories |
| --- | --- |
| Abu Dhabi | `Electronics`, `Kitchen Items` |
| Dubai | `Furniture`, `Kitchen Items` |
| Sharjah | `Pipes`, `Hardware`, `Utility products`, `Kitchen Items` |

Prices are nonnegative numbers in AED, with no currency prefix in the cell. Quantities are nonnegative whole numbers. A blank price or quantity means unknown, never zero. Zero quantity means out of stock. `keywords` can contain synonyms separated by spaces or commas; add English and Roman Urdu terms used by your customers.

Do not edit `Chatbot_View`. The adapter reads each branch sheet, assigns its branch, derives stock status and regenerates the consolidated view. An installable edit trigger updates manual edits; a five-minute timer catches imports/formula changes. A chat request also refreshes a view older than five minutes. Invalid category, duplicate ID, price or quantity stops synchronization and is reported in Apps Script executions. Fix the source row and run `syncChatbotView()`.

Kitchen products remain independent branch records, even if their names match. Prices and quantities are never combined across branches.

## Deals and branches

Use exact branch names: `Abu Dhabi`, `Dubai`, `Sharjah`. Dates should be date cells or ISO `YYYY-MM-DD` strings; start/end days are inclusive in UAE time. Blank date boundaries are open-ended. Active promotions from inactive branches are excluded. `category` should use an allowed category. `product_id` is optional for a product-specific promotion. `free_item` enables questions about free-item offers. `discount_type` and `discount_value` are descriptive business data, not automatic price calculations.

Use `Hardware` for Sharjah tool deals (`DEAL006` currently needs this correction), alongside `Pipes` and `Kitchen Items`. The deal reader accepts legacy `Tools` as `Hardware` without changing the Sheet. Displayed benefits support `percentage`, `fixed` (AED amount), and `free_item`; a nonblank `free_item` is also displayed alongside other discount types. Benefits already stated in the title/description are not repeated. These fields never change the saved product price.

Public branch cards/details use active `Branches` records. Keep branch IDs `AD`, `DU`, `SH` to associate records with the existing page routes. City values must continue to match product/deal branch values. General editorial headlines and navigation routes remain in the frontend.

`image_url`, `whatsapp` and `map_url` must be HTTPS URLs. For WhatsApp use `https://wa.me/971...`. Store phone numbers as plain text with their international prefix. Use complete addresses and accurate hours; setup intentionally leaves these blank. Only publish promotions you have approved.

## Accounts and logs

Users are created after email verification. `status` must be `active` for access; set it to `disabled` to block existing sessions. The `role` column reflects the role at login but cannot grant privileges: the server derives ownership from `OWNER_EMAILS` on every protected request.

Chat logs include the complete structured response as JSON so product prices, stock and deals shown at that moment can be reviewed later. Guest chats have no `user_id`. Login logs record successful sign-ins, failed valid-format code attempts, and explicit logout time. An expired/abandoned session does not invent a logout timestamp. Activity logs record login, logout and dashboard section views, without logging every public page visit.

Daily maintenance removes expired codes, expired sessions and expired rate counters. Business logs are retained until the owner archives/deletes them. Choose and communicate an appropriate retention period before launch. Never archive into a publicly shared spreadsheet.
