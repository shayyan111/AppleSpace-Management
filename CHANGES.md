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
