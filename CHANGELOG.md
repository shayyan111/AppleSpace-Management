
## Date-range record cleanup

- Added an owner-only Record cleanup page with inclusive date inputs, deletion preview counts and an exact typed confirmation.
- Blocked current-year and future-year ranges in both the UI and database using the ongoing Pakistan business year.
- Preserved active stock, unpaid balances, newer/out-of-range dependencies, contacts, staff, accounting entries and audit history.
- Added a pre-deletion snapshot, stale-preview validation, atomic deletion, audit logging and idempotent retries.
- Added year-rollover/date-validation tests, UI access checks and rollback-only database scenario verification.
