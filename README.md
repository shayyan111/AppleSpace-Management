# AppleSpace Management

AppleSpace store ERP built with React, TypeScript and Vite, using the existing shared Supabase database. This repository includes the workflow upgrades from V6.1, a grey/charcoal interface, repeatable setup, VS Code tasks, and automated checks. See [IMPLEMENTED-CHANGES.md](IMPLEMENTED-CHANGES.md) for the requested changes.

For daily use on a shop laptop, see [SHOP-HANDOVER.md](SHOP-HANDOVER.md) for production hosting, owner/staff accounts, desktop installation, and the supplier ledger. Fresh app openings and page reloads now require sign-in; Settings, Reports, Daily Closing and Record Cleanup also require owner password verification.

## Open in VS Code on Windows

Install Git, VS Code, and Node.js 24 LTS (minimum supported version: 22.12).

In VS Code, press **Ctrl+Shift+P**, choose **Git: Clone**, and paste:

```text
https://github.com/shayyan111/AppleSpace-Management.git
```

Choose a folder on your computer and click **Open** when cloning finishes. Open **Terminal > New Terminal** in that folder and run:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open the address printed by Vite, normally **http://localhost:5173**. Sign in using your existing AppleSpace staff email and password. A valid, active staff profile is required; cloning the repository does not create a new login.

The first start creates `.env.local` from `.env.example` for the existing store database. Existing `.env` or `.env.local` files are preserved. Only the Supabase URL and browser publishable key are included in the template. Passwords, service/secret keys, and private server configuration must stay outside source control.

`npm.cmd` avoids the Windows PowerShell `npm.ps1` execution-policy issue. You can also double-click `start-Windows.cmd`. VS Code's **Terminal > Run Task** includes install, start, and build tasks. Start the app before using the Chrome debug configuration.

### Command-line clone

```powershell
git clone https://github.com/shayyan111/AppleSpace-Management.git
cd AppleSpace-Management
code .
npm.cmd ci
npm.cmd run dev
```

### Get later updates

Stop Vite with **Ctrl+C**, then run:

```powershell
git pull
npm.cmd ci
npm.cmd run dev
```

Commit or stash your own code changes before pulling. Your ignored local environment file stays on your computer.

## Included modules

- Dashboard, daily revenue, stock alerts, dues, and owner profit.
- Phone inventory with IMEI/stock codes, asking prices, battery/PTA information, repair status, barcode/QR labels, and website catalog visibility.
- Phone and accessory purchases, supplier payments, seller photos, required new-phone purchase costs, and per-phone expenses.
- Phone/accessory sales, customer creation, barcode entry, discounts, partial payments, complimentary lines, invoices and PDF/WhatsApp sharing.
- Customers and shopkeepers, opening receivables, statements, payment history, and WhatsApp reminders.
- Supplier ledgers, expenses, daily opening/closing counts, accounting reports, owner-only profit, staff access, audit history, and backup export.
- Built-in store analytics assistant and an optional Python AI server.

See [CHANGES.md](CHANGES.md) for the full change history. Sales remove published phones from the shared website catalog transactionally; the website must read that catalog to show the changes.

## Existing database

This application uses the existing AppleSpace database, not an empty local database. Core ERP RPCs (`erp_read`, `erp_action`, `erp_get_backup`) and row security on the principal business tables were confirmed during this repository import.

The SQL files in `database/` are upgrade history and verification scripts for the earlier schema. **Do not run them all on your existing project, and do not treat them as a fresh-project bootstrap.** The V5/V6 workflow upgrade has been applied to the connected project. Do not rerun its SQL files. Verification transactions were rolled back; existing business records were retained.

## Checks

```powershell
npm.cmd test
npm.cmd run build
```

GitHub Actions runs the frontend checks and optional server unit tests after pushes and pull requests. These checks do not use an account password or write to the store database.

The database verification scripts contain rollback tests and assume the original owner UUID. Review them and choose a suitable test environment before running them. Some older batch tests target older function behavior. `database/verify-workflows.sql` covers current purchases, sales, repeated buybacks, archive prices, restocking, old balances and staff permissions, entirely within a rollback.

## Optional AI server

The built-in analytics assistant works without the Python server. To enable external AI chat, install Python 3.11+ and run:

```powershell
py -m venv .venv
.venv\Scripts\python.exe -m pip install -r server\requirements.txt
copy server\.env.example server\.env
```

Set `OPENAI_API_KEY` and `OPENAI_MODEL` in `server/.env` using a model supported by your API account, then start:

```powershell
.venv\Scripts\python.exe -m uvicorn main:app --app-dir server --host 127.0.0.1 --port 8000
```

Add `VITE_AI_SERVER_URL=http://127.0.0.1:8000` to `.env.local` and restart Vite. The server verifies the caller's Supabase token and sends role-filtered aggregate facts to the OpenAI Responses API. Contact details, CNICs, and photos are excluded. Live provider chat requires your API billing and has not been tested with a live OpenAI key.

Run server unit tests with:

```powershell
.venv\Scripts\python.exe -m unittest discover -s server -p "test_*.py"
```

## Practical limits

The requested workflow changes are implemented: dedicated sold-phone archive, IMEI buyback with separate purchase/sale lifecycles, separate supplier directories, optional registered-supplier photos, accessory restocking, shopkeeper sales, billing staff names, full bill summaries, phone-camera scanning, customer details/history and CRM drafts. Walk-in seller photos remain required. New phone purchases require storage, PTA status and purchase cost. Older pending-cost records can still be completed through Purchases. CRM opens a personalized WhatsApp draft for review; it does not automatically broadcast or confirm delivery. Camera scanning needs HTTPS (or localhost) and camera permission; a plain HTTP LAN address does not provide phone camera access. Camera hardware and scanning accuracy must still be checked on the target phone.

One individually tracked phone is supported per sale, with accessory/complimentary lines. Returns/refunds, tax handling, transaction reversals, full disaster-recovery restore, and advanced forecasting are not implemented. Historical reconciliation payments post when recorded. Physical scanners and thermal printers have not been tested here.

Daily JSON snapshots are inside the database; export independent copies for disaster recovery. Auth passwords and photo binaries are not included. PDF export uses a Latin font; browser printing is preferable for non-Latin customer names. Large histories need pagination and server-side aggregation.

## Production build

```powershell
npm.cmd run build
npm.cmd run preview
```

Or use Docker:

```powershell
docker build -t applespace-erp .
docker run --rm -p 8080:80 applespace-erp
```

A remote optional API server needs HTTPS and explicit frontend origins. This repository import does not deploy a public website.

## Delete old records

Owners can open **Record cleanup** from the sidebar and choose **From date** and **To date** (both inclusive, Pakistan time). Click **Preview records** to review eligible and protected counts, then type the displayed confirmation to delete eligible history. Managers and salespeople cannot use either cleanup endpoint.

The date range must end before January 1 of the ongoing year. This rule is enforced in the database as well as the page, and advances automatically each year. Current-year invoices, payments, expenses, stock and sessions remain protected. Old invoices with newer/out-of-range payments or child records are skipped. Purchases supporting retained stock or unpaid supplier balances remain saved; unpaid invoices, active stock, master contacts, staff, ledger entries and audit history are retained.

Cleanup removes eligible invoices and their line items/payments/cost snapshots, fully settled purchases and supplier payments, old sold-phone history/inventory where dependencies permit, expenses and closed daily sessions. A preview token detects changes to the eligible records before deletion; retrying the same completed request returns the original result. A snapshot is saved before anything is deleted. Use **Export backup before deletion** after cleanup, or export it from **Settings → Recent snapshots**. Snapshots have the existing 30-day retention; exported JSON excludes photo binaries and Auth credentials. Restoration requires a reviewed database import; there is no one-click undo. Image database rows may be removed, but storage files are retained.

Ledger entries are preserved to maintain cash, receivable, payable and account totals. History-based reports and CRM purchase history will omit the deleted details. Export historical reports before cleanup if you need to retain those breakdowns.

For an existing installation with the V6 upgrade, apply `supabase/migrations/20261007210231_record_cleanup.sql`. This incremental migration depends on the earlier SQL in `database/`; it is not a fresh-database bootstrap. Verify using `database/verify-cleanup.sql` in a SQL editor: all fixtures, deletions and backups in that verification transaction are rolled back. Frontend checks: `npm test` and `npm run build`.

## Purchases, customer dues and offer recipients

Purchases show the seller name, both available IMEIs, model/storage, total and remaining payable. Search by seller, IMEI, model or purchase number; the Excel export includes these fields. Fully paid purchases show **Paid**, and phones with an unresolved purchase cost show **Cost pending**.

For registered iPhone suppliers, **Seller name** is the only required seller-detail field. Mobile, CNIC and photo are optional; entered mobile/CNIC values must still have valid lengths. Selecting an existing supplier preserves their saved details when optional fields are blank. Model, IMEI, storage, PTA status and purchase cost are required phone fields. Walk-in sellers still require their identity details and photo. Apply `supabase/migrations/20261007211606_supplier_optional_details.sql` after the V5 workflow upgrade for the backend validation change.

**Customers** and **Shopkeepers** show only contacts with an outstanding balance across all their invoices and old opening balances. After final payment they disappear from this dues view; saved contacts remain in Customer messages and the sale customer selector. Their original invoices stay in Sales & invoices. Settled opening balances appear there as labeled receipts, keeping their original opening-balance classification and avoiding new sales revenue.

In **Customer messages**, select individual customer checkboxes or **Select all matching**, edit the offer, and click **Prepare selected messages**. Review the selected recipient list, then use **Review next in WhatsApp** to open each personalized draft. Press Send in WhatsApp. Selections remain selected when you change filters; **Clear selection** resets them. The app does not automatically send messages or confirm delivery.

Verification: `npm test`, `npm run build`, and the rollback-only SQL scenarios in `database/verify-supplier-details.sql`.


## Other receivables, payables and protected reports

Apply `supabase/migrations/20261007213726_ledgers_costs_owner_locks.sql` after the preceding migrations. This adds both ledgers, requires storage/PTA/purchase cost for new phone purchases, and restricts daily opening/closing to owners. A purchase cost of zero must be explicitly entered; blank costs are rejected. Existing pending-cost history remains available.

Inventory displays purchase cost and sale price for phones, and per-unit purchase cost for accessories, for owners/managers. Purchase costs stay hidden from salespeople. Reports and Daily closing are owner-only; the database also rejects non-owner opening/closing and hides session details. This uses the staff role, without a separate page password.

Owners/managers can open **Receivables ledger** or **Payables ledger** to view invoices/purchases together with non-phone balances. Add the person/business, amount, date and optional description/reference/due date, then receive/pay partial or full amounts. Overpayments are rejected. Fully settled entries remain in **All records / history**. Exports and payment history are available.

Choose the category that reflects the transaction: **Existing balance** records an opening amount against equity; **Money lent / advance** and **Money borrowed / received** move the selected cash/bank account without creating income; **Other service income owed** adds income; **Expense owed** adds an expense. Settlement reduces the corresponding receivable/payable and moves cash/bank. Record dates use Pakistan time and cannot be in the future. Both new ledger tables are included in backups and retained during old-record cleanup.

For a complimentary cable or other stocked accessory, select the inventory accessory and enter zero (or leave its selling price blank) in the invoice. Its quantity reduces stock and its stored purchase cost is captured at the time of sale. Backend invoice profit equals the final customer bill minus all item cost snapshots, including free accessories. The customer bill remains unchanged. Later restocking or purchase-cost changes do not rewrite past profit. The owner **Invoice profit** report displays this result; **Profit per IMEI** also deducts included free-accessory costs.

Verification: `npm test`, `npm run build`, and rollback-only SQL scenarios in `database/verify-ledgers-costs.sql`, `verify-workflows.sql`, `verify-supplier-details.sql` and `verify-cleanup.sql`. Earlier batch verification scripts document older versions and their former optional-cost behavior.


## Compact labels, invoice details and simpler entry

Apply `supabase/migrations/20261007221937_invoice_labels_validation.sql` after the ledger migration. Receivable/payable descriptions are optional. Expense descriptions are required only for **Other** (including **Other phone expense**); other categories accept blank descriptions. **Paid now** is required for phone/accessory purchases and quantity additions: enter `0` when nothing has been paid.

**Inventory → Accessories → Add quantity** uses the saved unit purchase cost, without asking for a new cost, and posts the corresponding stock/purchase payable. It preserves the SKU and historical invoice costs. The original supplier is reused automatically; supplier and cost fields are not shown.

Choose **Label / Labels** in Inventory, or find a phone/accessory in **Labels & scanner**. Accessory labels print one label for the product regardless of stock quantity; phone labels offer a copy count. Labels default to compact **40 × 25 mm**; select **50 × 30 mm** for larger label paper. The QR sits beside the details and the Code128 barcode spans the bottom, retaining white quiet zones around both codes. Phone labels show model/storage, PTA status, IMEI (and IMEI 2 when present), with optional recorded battery health. All units of an accessory share its SKU: a single cable label identifies Cable when scanned, without encoding the quantity. Match the printer's paper size to your selection, print at **100% / actual size**, and turn margins and browser headers/footers off. Physical printer/scanner verification remains device-specific.

**Bill made by** accepts a typed name, defaulting to the signed-in staff name. The authenticated staff account remains the audit actor. Checkout summaries include recorded phone details. Printed/PDF invoices show model, storage, IMEI and standalone PTA status (Non-PTA, JV or PTA Approved), and omit battery health. Phone details are saved on the sale item so later inventory edits do not alter invoice history.

In **Sales & invoices**, choose **WhatsApp PDF** to prepare the full invoice PDF, including the saved product details, bill made by, payments and balance. The dialog shows the customer's name and number. On devices that support file sharing, press **Send PDF via WhatsApp**, choose WhatsApp and the customer, then press Send. The file is prepared before the share-button click so slow PDF generation does not expire the browser's share permission. Cancellation leaves the PDF ready to retry. Otherwise, **Download PDF & open WhatsApp** downloads the PDF and opens the saved customer's chat; attach the file with **Attach → Document**, then press Send. The dialog keeps a separate **Download PDF** and **Open customer chat** option for retrying. The app does not report delivery based on opening a share sheet or chat, and does not automatically attach a file through a WhatsApp chat link.

Verification adds invoice/message/label generation tests and `database/verify-invoice-labels.sql`, using rollback-only fixtures.


## Print forms, supplier continuity and balance reminders

Apply `supabase/migrations/20261007230424_document_details_existing_supplier.sql` after the invoice-label validation migration. New accessory purchases require an existing accessory supplier or a new supplier name. **Add quantity** reuses the original supplier and saved cost, preserves the SKU, and records a separate purchase with the quantity added. Original purchase product details remain saved even after later restocking.

Sales invoices and purchase slips use a borderless white A4 layout with a faint AppleSpace logo watermark, business contact information, terms and signature areas. The invoice table is labeled **Product** and shows only recorded product details. Both documents show payment methods and amounts; the purchase slip adds the purchase price and includes the saved seller photo when available. Use **Download purchase slip PDF** in Purchases. The purchase slip contains the main seller section only, without a separate seller receipt. Saved seller photos print beside the seller details. Uploaded manual-form images are not bundled or published.

In **Receivables ledger**, outstanding records with a phone number offer **Remind on WhatsApp**. The draft includes the person, reference and current outstanding amount. Review it and press Send in WhatsApp. Settled entries and payables do not show the reminder action.

Validation: `npm test`, `npm run build`, and rollback-only scenarios in `database/verify-document-details.sql`, plus the existing invoice-label, ledger, supplier, workflow and cleanup scenarios.

The forms embed the licensed DejaVu Sans font in PDFs and browser print output for consistent typography. Font files and their redistribution license are in `src/fonts`.

Both forms include the saved ASPACE logo and Apple Space name at the top, with Sharoz Abbasi and Saad Ali Awan and their business numbers at the top right. The invoice has no seller-signature field; purchase signature fields remain. The same original transparent logo is used at reduced opacity behind the details.

## Seller photos and phone-camera scanning

In **Purchases → Add purchase → Seller details**, click **Take seller photo**, allow camera access, select the built-in or connected USB camera, and click **Capture photo**. Preview the attached photo, retake it if necessary, then save the purchase. Choosing a saved JPEG/PNG/WebP photo is also supported. Registered supplier photos remain optional; walk-in seller photos remain required. Capturing a photo does not upload it until the purchase is saved, and closing/switching the camera stops its video tracks.

Open the deployed HTTPS ERP address on your phone and sign in. In **Labels & scanner**, tap **Scan barcode / QR with camera**, allow access, and point the rear camera at the stock label. Select a different camera if needed. The scanned IMEI/stock code/SKU finds the product, and **Create sale** starts checkout with that phone or accessory. In **Sales & invoices → New sale**, **Use phone camera** adds scanned items directly to the bill. Code128 and QR labels are supported; accessory scans identify the shared product SKU and add one unit at a time, preserving its stock cost for invoice profit.

From a laptop, click **Labels & scanner → Open scanner on phone** to display a link QR. Scan that link using the phone's regular camera, open the ERP, and sign in; the `#scan` link opens the stock scanner after login. Stock scanning and checkout run in the phone's ERP session. This link does not pair the phone camera with an open laptop checkout.

Use good lighting and keep the complete barcode/QR in view. Camera permission is required; HTTPS or localhost is required for browser camera access. On a phone, use the deployed HTTPS address rather than an HTTP LAN development URL. Permission-denied/busy/missing-camera errors offer retry guidance. Real laptop/phone camera accuracy still needs checking on the target devices.
