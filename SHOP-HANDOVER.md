# AppleSpace ERP: shop laptop setup

## What the owner receives

The owner opens an AppleSpace desktop icon, enters their ID (account email) and password, and works in the ERP. Stock, invoices and payments are saved in the shared online database. The shop laptop needs an internet connection. Installing the website as an app does not add offline transactions.

Keep development in VS Code on your development computer. For daily shop use, host the production build at a permanent HTTPS address; the owner should not need to start a terminal or Vite.

## 1. Publish the production website

1. In Vercel, choose **Add New → Project** and import `shayyan111/AppleSpace-Management` from GitHub. Use the repository root as the root directory.
2. Select the **Vite** framework preset. The included `vercel.json` sets installation to `npm ci`, build to `npm run build`, and output directory to `dist`.
3. Select a supported Node.js version (24.x is used by the repository checks).
4. In project environment variables, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` using the existing AppleSpace Supabase project. These are browser configuration values. Never put a Supabase secret/service-role key in any `VITE_` variable. `VITE_AI_SERVER_URL` is optional and requires a separately deployed assistant API.
5. Deploy. Keep the generated HTTPS address, or attach a domain/subdomain you own, such as `erp.yourshop.com`. Update Supabase **Authentication → URL Configuration** to the production address if you use redirects or recovery workflows.
6. Open the deployed address and confirm that it shows the login screen and connects to the correct store. GitHub publishing and website deployment are separate actions; the configuration file does not create a Vercel project automatically.

Source: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite).

## 2. Set up owner and staff access

- The login ID is the existing account email. This update does not create or change anyone's password.
- Give the owner their own account with the `owner` staff role. Give employees separate accounts with `manager` or `salesperson` roles according to their work. Do not share the owner account with staff.
- For new employees, an administrator creates the user through Supabase **Authentication → Users**, copies the user's UUID, then the owner uses **Settings → Assign staff profile** to assign the matching UUID, name, role and active access. Give credentials directly to the employee through a private channel.
- Every new app opening, new tab, or page reload requires login. The app keeps its session in memory rather than saving it in browser storage. Navigation inside the open ERP does not log you out; the ERP's **Refresh records** button also keeps you signed in.
- Settings, Reports, Daily Closing and Record Cleanup are owner-only screens. Each page asks for the signed-in owner's ID/password again, then relocks when leaving that page, hiding the app, or after ten minutes. The same owner credentials are used, rather than a separate shared PIN.
- Page unlock is an additional screen privacy check. Database role checks remain the authority for access; it is not a separate server permission or a substitute for individual staff accounts. An owner session already receives its permitted report data.
- Use **Sign out** before handing the laptop to a different employee, and lock Windows when leaving the counter.

## 3. Put AppleSpace on the shop laptop

1. Open the deployed HTTPS address in Chrome.
2. Choose **⋮ → Cast, save, and share → Install page as app…**.
3. Name it **AppleSpace ERP** and complete installation.
4. Open `chrome://apps`, right-click AppleSpace ERP, and choose **Create shortcut** to place it on the desktop. Pin it to the Windows taskbar if useful.
5. Open the desktop icon and sign in. Close the app completely and reopen it to verify that the login screen appears again.

Source: [Chrome web app installation and shortcuts](https://support.google.com/chrome/answer/9658361?hl=en).

## Camera photos and scanning

On the laptop, go to **Purchases → Add purchase → Take seller photo**, allow camera access, select the built-in/USB camera and capture the seller. Retake or upload a saved photo if needed. Save the purchase to upload the selected photo.

On the phone, open the same deployed HTTPS address, sign in, and go to **Labels & scanner → Scan barcode / QR with camera**. Alternatively, the laptop's **Open scanner on phone** button displays a QR link that opens this page after phone login. Use **Create sale** for a scanned product, or **Sales & invoices → New sale → Use phone camera** to add stock to a bill. Each accessory uses its shared SKU. A successful scan beeps once. Use **Test beep** to check sound, and turn up device media volume. Keep the complete label sharp in the preview; use the available torch/zoom controls for small labels. The phone runs its own checkout; the link does not send scans into an open laptop bill.

## 4. Understand the supplier statement

Open **Suppliers → Statement** beside an iPhone or accessory supplier. The statement is oldest first and includes date/time in Pakistan time, purchase reference, model/accessory, saved IMEI, purchase amount, payment method, payment amount, and balance owed after that entry.

| Entry | Bought | Paid | Balance owed |
| --- | ---: | ---: | ---: |
| First phone | Rs 100,000 | — | Rs 100,000 |
| Payment to supplier | — | Rs 50,000 | Rs 50,000 |
| Second phone | Rs 60,000 | — | Rs 110,000 |

The supplier receives the payment, so a payment reduces what the shop owes. A new purchase increases it. **Pay supplier** applies a payment to the oldest unpaid purchases. A payment spanning several purchases appears as its individual allocations with their purchase references; the allocations add up to the payment. **Pay a specific purchase** lets you select an individual purchase instead. Print/PDF and Excel include the chronological ledger and product details.

This statement covers purchase-linked supplier balances. Other manually entered payables remain in **Payables ledger**. If legacy stock still needs a purchase cost, the statement marks the known balance as incomplete until that cost is recorded.

## 5. Finish the handover

Before recording real trading, verify owner/staff permissions, the receipt printer, label paper size, IMEI/barcode scanning, PDF download and WhatsApp invoice sharing on the actual laptop. Use a separate test database for trial purchases and sales.

Arrange a provider backup and an exported copy outside the database, and test restoring on a separate database. ERP JSON exports do not include seller photo files or Auth credentials; those need their own backup plan. Give the owner the login, website address, backup procedure and support contact privately. Keep hosting/database account ownership and billing clear so the shop can continue operating.

Useful future additions are self-service password recovery, staff invitations inside the ERP, owner MFA, session inactivity logout, and monitored backups. These are separate from the supplier statement and login changes in this update.

## Large record lists

Lists show 50 records per page. Use Previous, Next or the page selector to see more. Search covers all saved records, and exports include every matching record across pages. Dashboard/ledger totals use the full dataset. In Customer messages, Select all matching selects matching customers across pages. Pages and printing tools load the first time they are used, then remain available in the current browser session.
