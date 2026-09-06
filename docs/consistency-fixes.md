# Focused consistency fixes — 6 September 2026

Frontend branch cards, specialties, category tags, descriptions, contact details and deal filters now use active `Branches` data. Contact URL validation is unchanged. Static marketing copy and the three navigation routes remain local. No Google Sheet records were changed.

The chatbot deal reader maps legacy `Tools` to canonical `Hardware`. Deal cards and chatbot cards show structured percentage/fixed-AED discounts and free items when not already stated in their title/description. Chatbot cards also show deal dates. No product prices are recalculated.

## Google Sheet changes needed

- Replace `Abu Dhabi Branch Address`, `Dubai Branch Address`, and `Sharjah Branch Address` with actual addresses.
- All three phone cells currently contain numeric `923038163840`; Call links remain hidden because the international `+` is missing. Store the correct branch number as plain text including `+`. Do not assume the shared number is correct.
- WhatsApp now contains a syntactically valid `https://wa.me/923038163840` and maps contain HTTPS short links. These are no longer the earlier invalid placeholders, but their actual destinations need owner verification, as do branch emails and opening hours. No contact details were invented or replaced.
- Change Deals row `DEAL006` category from `Tools` to `Hardware`. The compatibility mapping also handles it after redeployment.
- Confirm intended deal start/end dates, stored as date cells or `YYYY-MM-DD` strings. Confirm whether “Electronics Weekend Offer” should span the entire saved date interval.

## Deployment/date mismatch

The live API still returns `2026-08-31T23:00:00+04:00` / `2026-09-29T23:00:00+04:00`. Local `Store.gs` already serializes native date cells as `yyyy-MM-dd` in the spreadsheet timezone. Local checks demonstrate that September 1/30 date cells in a UTC+05 spreadsheet remain September 1/30, rather than shifting back one day in UAE time.

This is consistent with an older deployment missing the local date fix. Deployment history and raw Sheet cell types were not accessible, so its age cannot be proven: text cells containing timestamps could also pass through the current code unchanged. The frontend does not guess a timezone correction or change intended offer dates.

Copy the current local `Chatbot.gs` and `Store.gs` into their corresponding files in the existing Apps Script project and save. Then use **Deploy → Manage deployments → Edit → New version → Deploy** on the existing deployment, retaining the current `/exec` URL. No deployment was performed here. If dates still return timestamps, replace timestamp text in the Sheet with the intended native date cells/date-only strings.

## Focused verification

`tests/consistency.test.cjs` covers branch facts/details, valid/invalid contact links, inactive branches, backend errors, safe rendering of Sheet text, structured benefits, UAE date boundaries, and Sharjah hardware/Dubai furniture chatbot lookups. It uses the existing browser-test runtime; no application backend or dependencies were added.

Live baseline: branches/deals succeeded; Sharjah hardware returned zero deals; Dubai furniture returned two. These are results from the existing deployment, not the undeployed fix. The two authorized chat checks created normal chat log entries. Authentication and the full test suite were not run.
