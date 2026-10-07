# Requested AppleSpace changes

| Area | Implemented behavior |
| --- | --- |
| Inventory price | Single intended sale price in the inventory list and edit form. Purchase cost is managed under Purchases. |
| Walk-in sellers | Separate purchase-history contacts, excluded from registered supplier directories. |
| Supplier photos | Optional for registered iPhone suppliers; required for walk-in sellers. |
| Supplier directories | Separate iPhone and accessory supplier lists. |
| Accessory quantities | Add quantity to an existing SKU with supplier/payable records and weighted purchase cost. |
| Sold Phones | Dedicated archive and history tab; sold phones are excluded from active inventory and public website stock. |
| IMEI buybacks | Same IMEI may be purchased again after sale. Each purchase creates a separate inventory lifecycle, retaining original purchase, invoice, cost and archive history. Duplicate IMEI 1/2 matches are rejected across active stock. |
| Shopkeeper Sale | Separate customer/shopkeeper sale types and contacts. |
| Customer requirements | Required name and 11-digit phone, checked in the UI and database. |
| Billing staff | Select an active staff member; preserve their displayed name on the invoice and show it in sales, printing and PDF export. |
| Bill summary | Itemized phone/accessory quantities, amounts, discount and total displayed before payment details. |
| Scanning | USB/Bluetooth keyboard scanners and phone-camera barcode/QR decoding. Camera streams close on cancellation, success or failure. |
| Customer details | Dedicated details view with contact fields, invoice/item/IMEI history, spending, outstanding balance and payments. |
| Customer CRM | Greetings, offers, updates and follow-up templates; editable drafts, audience filters, individual preview and personalized WhatsApp drafts. |
| Legacy balances | Historical customer/shopkeeper receivables remain separate from sales revenue, with partial/full payment support and CRM balances. |
| Reports permissions | Owner-only reports and financial datasets; salesperson purchase costs are excluded by the backend. |
| Theme | Light grey surfaces with charcoal navigation. |

## Validation

- Production TypeScript/Vite build.
- 13 frontend tests covering finance, customer history, camera cancellation/resource release and rendered workflow forms.
- Four optional API tests.
- Rollback database verification: purchase retry, optional cost, seller separation, active cross-IMEI duplicate rejection, missing customer phone rejection, shopkeeper sale, billing staff snapshot, sold archive price, website removal, two sell/buyback lifecycles, immutable original purchase/profit, accessory restocking/sales, legacy payments, balanced journals and role restrictions.
- Anonymous archive access revoked; guarded private read function exposed through an invoker wrapper.

Camera access requires HTTPS or localhost and browser permission. Target-phone camera accuracy, physical USB scanners and thermal printers still need hardware testing. WhatsApp drafts open for review and sending by the operator; no automated broadcast or delivery tracking is included.

The connected database has been upgraded. Do not rerun the V5/V6 SQL upgrade files there.

## Update an existing clone

```powershell
git pull origin main
npm.cmd ci
npm.cmd run dev
```
