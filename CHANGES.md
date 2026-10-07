# Incremental changes — Dashboard and Inventory

- Dashboard: New Purchase and Pay Supplier shortcuts; supplier payment allocates oldest unpaid purchases first.
- Inventory: separate iPhones and Accessories tabs, combined storage/PTA/model/status/battery filters, below 80% excludes unrecorded batteries.
- Owner and manager see and edit phone purchase and asking prices. Salesperson sees asking prices only. Cost corrections update linked purchase totals and post balanced accounting adjustments; reductions below money already paid are rejected. Sold phones retain immutable costs.
- Per-phone expense form links expense to the phone and deducts it in Profit per IMEI. Period selection selects sales; the per-phone report includes all expenses recorded for each selected phone.
- Repair checkbox records stock movements and synchronizes website availability.
- Accessories: stock purchases, quantity, unit purchase and sale prices, supplier dues and editable descriptive/sale details. Accessory sales are not part of this batch.
- Migration: database/batch-v1-dashboard-inventory.sql applied. Rollback-only verification: database/verify-batch-v1.sql.
- Production build and financial unit tests pass. Test business records rolled back.

Current ZIP delivered at user request; further changes deferred.

## Purchase batch
- Existing seller selection autofills name, mobile and CNIC and reuses saved photo. Missing existing details must be supplied.
- Phone purchase requires 13 numeric CNIC digits, 11 mobile digits, a seller photo and 15 IMEI digits. Normalized CNIC uniqueness enforced across sellers. Select an existing seller for repeat purchases.
- Supplier / walk-in seller choice; new seller creation during purchase.
- Serial field removed. Storage 32GB to 2TB. Battery and condition remain optional.
- Purchase cost optional: blank stores pending cost, zero payment required, and Inventory can resolve later. Set cost before sale to preserve valid profit snapshots.
- Optional phone expense posts with purchase atomically and links to its phone.
- Purchase type selector provides accessory purchase without CNIC/mobile/photo requirements. Vendor selection or new vendor name links its payable ledger.
- Applied database/batch-v2-purchase.sql; rollback verification database/verify-batch-v2.sql passed. Production build and finance tests passed.

## Sales and invoice batch
- Search saved sales by invoice/IMEI and filter by date range.
- Scanner input accepts USB barcode/Enter, phone stock code/IMEI and accessory SKU. Matching available stock is selected directly.
- Inline customer creation with required name/11-digit phone; partial payment creates the customer receivable atomically. Customer page retains balances, editing, statements and reminders; creation moved to invoice.
- Complimentary invoice-only lines and stocked accessories; blank line price prints Included. Optional accessory prices count toward totals; standalone accessory sales supported. Stocked accessory quantities and immutable costs update atomically.
- Customer name and phone included on printed and PDF invoices. Warranty removed from both outputs pending user invoice instructions. Multi-page PDF handles longer invoices.
- Existing WhatsApp PDF sharing retained: system share sheet where supported, otherwise PDF download and WhatsApp draft; attach the PDF manually on desktop.
- Migration database/batch-v3-sales.sql applied. Rollback financial/credit/customer tests and standalone stocked accessory test passed; build and finance unit tests passed.

## Customers batch
- Default Unpaid only list, with All contacts option. Separate Customers and Shopkeepers tabs.
- Owner/manager can add historical pending balances to new or existing contacts; required old reference, record date and positive remaining amount, with name/11-digit phone for a new contact.
- Opening receivable posts against opening equity, is excluded from revenue/invoices and remains in receivables/statements. Existing Receive payment supports partial/full settlement and reminders.
- Duplicate opening reference per customer rejected. Existing customer data retained.
- Applied database/batch-v4-customers.sql. Rollback verification covered shopkeeper creation, old balance, partial receipt, duplicate rejection and balanced journals. Production build and finance tests passed.

## Batch V5 — workflow upgrade
- Inventory now separates active iPhones, sold phones, and accessories.
- Purchase price is removed from the Inventory UI; inventory shows sale/asking price only.
- Sold phones are hidden from active inventory and retained in a Sold Phones history tab.
- Buying back a previously sold device reactivates the same IMEI instead of creating a duplicate active IMEI.
- Walk-in sellers remain purchase-history contacts but are excluded from registered supplier lists.
- Registered iPhone suppliers and accessory suppliers are separate directories.
- Supplier photos are optional for registered suppliers; walk-in seller photos remain required.
- Accessories support adding quantity to an existing SKU/record with a dedicated restock action.
- Sales support Customer Sale / Shopkeeper Sale, mandatory name + 11-digit phone, and bill-maker staff selection.
- Checkout highlights the total bill before payment details.
- Sales now support USB/Bluetooth barcode scanning and phone-camera scanning through the browser BarcodeDetector API.
- Customers page includes purchase history, last purchase, phones purchased, and legacy opening balances.
- Added Customer Messages / CRM workspace for greetings, offers, alerts, and after-sale follow-ups through WhatsApp.
- Reports remain owner-only; detailed financial datasets remain excluded from non-owner reads.
- Database migration: `database/batch-v5-workflow-upgrade.sql` (run after batch V4).

## Batch V6.1 - sold IMEI buy-back fix
- Added dedicated `sold_phones` archive.
- Replaced global IMEI uniqueness with active-stock-only uniqueness.
- Previously sold IMEIs can now be purchased again without a duplicate-IMEI database error.
- Active inventory still blocks duplicate IMEI 1 / IMEI 2.
- Sold phones stay hidden from website stock.
- Updated V6 migration to the exact version applied successfully to the connected Supabase project.

## Repository workflow integration
- Integrated saved V6.1 UI while retaining grey/charcoal theme and VS Code setup.
- Buybacks now create new inventory records; original purchases, invoices, costs and sold-phone archive entries remain intact across multiple sales of the same IMEI.
- Sold-phone prices use the actual discounted sale amount. Cross-column duplicates are blocked across active stock.
- Walk-in contacts are returned separately from registered suppliers and remain visible on purchase records.
- Pending purchase costs remain supported and can be corrected in Purchases.
- Bill-maker names are snapshotted and appear on saved sales and printed/PDF invoices.
- Added full itemized bill summary before payment; dedicated customer details with IMEI and payment history; editable CRM messages, individual previews, latest-phone personalization and legacy balances.
- Camera decoding uses bundled ZXing rather than depending on native BarcodeDetector availability. Streams stop when closed, decoded or failed. HTTPS/localhost and camera permissions are required.
- Archive RPC uses a signed-in invoker wrapper, private guarded read logic and revoked anonymous access. Archive records are included in internal snapshots.
- Frontend finance/history/camera/UI regression tests and optional API tests passed. Live workflow verification was rolled back before applying the upgrade.
