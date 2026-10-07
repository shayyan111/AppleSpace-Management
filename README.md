# AppleSpace Management

AppleSpace store ERP built with React, TypeScript and Vite, using the existing shared Supabase database. This repository includes the workflow upgrades from V6.1, a grey/charcoal interface, repeatable setup, VS Code tasks, and automated checks. See [IMPLEMENTED-CHANGES.md](IMPLEMENTED-CHANGES.md) for the requested changes.

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
- Phone and accessory purchases, supplier payments, seller photos, optional pending purchase costs, and per-phone expenses.
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

The requested workflow changes are implemented: dedicated sold-phone archive, IMEI buyback with separate purchase/sale lifecycles, separate supplier directories, optional registered-supplier photos, accessory restocking, shopkeeper sales, billing staff names, full bill summaries, phone-camera scanning, customer details/history and CRM drafts. Walk-in seller photos remain required. Blank phone purchase costs remain pending until set through Purchases. CRM opens a personalized WhatsApp draft for review; it does not automatically broadcast or confirm delivery. Camera scanning needs HTTPS (or localhost) and camera permission; a plain HTTP LAN address does not provide phone camera access. Camera hardware and scanning accuracy must still be checked on the target phone.

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
