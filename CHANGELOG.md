## Audible scans and faster camera decoding — 8 October 2026

- Added a short success beep for camera scans and matched USB/keyboard scans, with gesture-based audio unlock and a Test beep button. Sound failures do not block checkout.
- Replaced the general-purpose 500 ms scan loop with non-overlapping 100 ms retries, native barcode detection where available and a targeted software fallback. Fast passes alternate full-resolution centre, full-frame and rotated images; periodic deeper passes handle harder labels without slowing every frame.
- Requested sharper rear-camera video and continuous focus where supported. Added capability-based torch/zoom controls and an uncropped preview. No microphone access is requested.
- Added lifecycle, native fallback, audio, real-code decoding under reduced contrast, rotation and camera-control regression checks. Target-phone performance still needs hardware verification.

## Seller webcam photos and phone stock scanning — 8 October 2026

- Added live seller photo capture with built-in/USB camera selection, preview, retake/remove, file upload and original photo-required rules. Camera JPEGs attach to the normal purchase upload and are saved only with the purchase.
- Added camera barcode/QR scanning to Labels & scanner, product results and Create sale actions for phones/accessories. Added a phone scanner link QR and scanner deep link that opens after login.
- Improved checkout camera selection/retry and repeated accessory scans, retaining the shared SKU and preventing scanned quantities above stock.
- Added camera permission/cancellation/resource-release, captured-file, stock-code matching, actual Code128/QR decoding and rendered workflow checks. Updated shop instructions.

## Chronological supplier statements and fresh-session login — 8 October 2026

- Supplier statements now interleave purchases and payments by date/time, with saved product details, IMEI, payment method and a running balance. Same-time paid-now payments follow purchases; legacy missing costs are flagged. Print/PDF and Excel include the ledger.
- Removed persistent browser login. New openings and reloads require account ID (email) and password; account changes clear displayed records and conversations.
- Added owner password verification for Settings, Reports, Daily Closing and Record Cleanup, with page-leave, app-hide and ten-minute relocking. Settings is now owner-only.
- Added Vercel deployment configuration and a shop handover guide. Production hosting still needs to be configured in the hosting account.
- Added supplier-ledger, real SDK session-storage, credential-validation and rendered-screen checks.

## Logo branding and contact details on printed forms

- Added the saved transparent ASPACE logo to the header and as a faint background watermark on invoices and purchase slips.
- Added Sharoz Abbasi and Saad Ali Awan with their business contact numbers at the top right.
- Removed the invoice seller-signature field while retaining purchase signatures and the seller photo.

## Borderless invoice and purchase forms, accessory continuity and reminders

- Added white, borderless printed/PDF forms with a faint APPLE SPACE watermark, Product headings, optional recorded details, purchase prices and a larger saved seller photo. Purchase slips contain one seller section without a tear-off seller receipt.
- Displayed cash, bank transfer and other payment methods on both forms and invoice WhatsApp drafts.
- Removed supplier entry from accessory quantity additions and enforced original supplier/cost reuse in the database. New accessory purchases still require a supplier.
- Printed one shared accessory barcode label regardless of quantity; scanning continues to select the product.
- Saved purchase product snapshots and extended sale snapshots with recorded color, condition and warranty details.
- Added outstanding-balance WhatsApp drafts to receivables.
- Added PDF/form/UI tests and rollback database scenarios, including supplier continuity, idempotency and complimentary-accessory costs.

## Simpler entries, compact labels and invoice sharing

- Made receivable/payable descriptions optional and expense descriptions required only for Other categories.
- Accessory quantity additions reuse the saved purchase cost; added identical accessory labels.
- Added compact 50 × 30 mm phone/accessory labels with smaller QR/barcode, IMEI/PTA details and optional health.
- Saved phone details on invoice items and displayed them in checkout, print/PDF and WhatsApp messages.
- Replaced the billing staff selector with a typed billing name while preserving the authenticated audit actor.
- Added a dedicated customer WhatsApp invoice action alongside PDF sharing.
- Required Paid now for phone/accessory purchases and quantity additions, allowing explicit zero payments.
- Added output/UI checks and rollback-only database regression scenarios.

## Purchase requirements, ledgers and owner locks

- New iPhone purchases require storage, PTA status and purchase cost in the form and database; registered supplier identity details remain optional except name.
- Inventory shows phone and accessory purchase costs to owners/managers alongside sale prices.
- Added Receivables ledger and Payables ledger with non-phone balances, categories, partial/full settlements, search, history and exports.
- Added balanced accounting for opening balances, money lent/borrowed, service income owed and unpaid expenses; prevent overpayment and deduplicate retries.
- Locked Daily closing and Reports to owners, including database opening/closing checks and session-read policies.
- Added backend invoice-profit totals from immutable cost snapshots, including zero-price stocked accessories, and owner profit reporting.
- Included manual ledgers in daily and pre-cleanup snapshots while preserving them during record cleanup.
- Added UI, accounting, authorization and required-field regression checks.


## Date-range record cleanup

- Added an owner-only Record cleanup page with inclusive date inputs, deletion preview counts and an exact typed confirmation.
- Blocked current-year and future-year ranges in both the UI and database using the ongoing Pakistan business year.
- Preserved active stock, unpaid balances, newer/out-of-range dependencies, contacts, staff, accounting entries and audit history.
- Added a pre-deletion snapshot, stale-preview validation, atomic deletion, audit logging and idempotent retries.
- Added year-rollover/date-validation tests, UI access checks and rollback-only database scenario verification.

## Purchase details and customer workflows

- Purchases display seller name, IMEI, model, total and remaining payable; search and Excel export include the joined details.
- Registered supplier purchases require only the seller name in seller details. Phone, CNIC and photo are optional, with database validation updated to match.
- Customer dues lists hide fully settled contacts; invoices and messaging contacts remain saved. Settled legacy balances appear as labeled receipts in Sales & invoices without adding revenue.
- Customer messages support individual/all-matching selection and a personalized WhatsApp draft review list for deals and offers.
- Fixed CRM model-history rendering and rounded remaining balances to currency precision.
