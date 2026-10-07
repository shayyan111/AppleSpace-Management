## Simpler entries, compact labels and invoice sharing

- Made receivable/payable descriptions optional and expense descriptions required only for Other categories.
- Accessory quantity additions reuse the saved purchase cost; added identical accessory labels with selectable copy counts.
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
