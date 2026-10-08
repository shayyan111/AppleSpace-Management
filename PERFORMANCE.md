# AppleSpace ERP performance checks

This update reduces browser startup and repeated work as transaction history grows. Measurements below were taken in the development runtime on 8 October 2026 UTC (9 October in Pakistan).

| Check | Before | After |
| --- | ---: | ---: |
| Initial JavaScript, minified | 628,293 bytes | 438,882 bytes |
| Initial JavaScript, gzip | 180,711 bytes | 129,867 bytes |
| Build all customer histories: 1,000 customers / 10,000 invoices | 3,186.16 ms | 46.31 ms |
| Visible rows in the main large-record tables | All matching rows | 50 per page |

Startup JavaScript is about 30% smaller (about 28% less with gzip). The history measurement uses synthetic records in Node and compares the previous repeated-array-search algorithm with cold snapshot indexes. Both paths produce identical outstanding totals, purchased totals and phone counts. It measures this computation only; it does not mean the whole app or phone camera is 69 times faster. Timing varies by device and runtime.

## Changes

- Lazy feature-page and document-tool imports. Navigation hover/focus starts likely page imports ahead of the click. Failed page loads show a reload action.
- Indexed customer/supplier/product/payment lookups and exact barcode lookups. Weak caches follow immutable database snapshots, detect replaced/appended arrays and do not share snapshots across accounts.
- Cached full customer and purchase histories and receivable/payable rows. Date and PKR formatters are reused; financial reports compute one result per data/report/date selection.
- Paged main tables, customer detail histories and supplier ledgers. Search remains across all saved records. Exports include all matching records, summaries use all rows, and CRM Select all matching spans pages.
- Deferred text filtering on the main list pages so typing can interrupt stale list work.
- Concurrent refreshes share a request. Explicit post-save refreshes supersede old reads; account changes cancel pending work. No persistent record cache was introduced.
- Document downloads and native file sharing preserve their existing PDF content and permission-sensitive click behavior.
- Font requests begin from the HTML instead of waiting for a nested CSS import. The existing fonts and branding are retained.

## Validation and reproduction

Run `npm test` and `npm run performance`. The performance command builds a manifest and measures the initial static-import graph and both history algorithms. Test data stays in memory; it is never sent to the shop database.

Regression checks cover large-table row limits, totals across pages, partial/settled payments, archived phone identifiers, appended/replaced payment arrays, account isolation, duplicate reads, forced refresh cancellation and retry after network failure. Existing invoice/PDF, scan, ledger, cleanup and authentication checks also run.

A read-only check of the live store RPC succeeded. Database relationship indexes used by payment, purchase and journal lookups already exist; this pass does not change the schema or business records.

## Practical limits

Production latency also depends on internet quality, the browser and database response time. Physical laptop/phone timing has not been measured here. The current store RPC still loads a complete authorized snapshot on refresh; this pass removes repeated browser work and redundant reads. If years of history make that payload large, the next step is server-paged history endpoints and summary RPCs, preserving complete financial calculations.
