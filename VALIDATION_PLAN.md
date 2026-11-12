# Validation plan — required before operational use

## Functional verification completed in this package
- JavaScript syntax checks passed for app, engine and service worker.
- Automated engine smoke tests passed (10 groups).
- Static package checks verify required app views, forms, stores, manifest assets and service worker shell references.

## Required next validation by the laboratory
1. Verify all statistical functions against independently calculated reference vectors.
2. Verify Westgard semantics against the exact policy adopted by the lab, including multi-level R4s, 2_2S, 4_1S and 10X scope, missing data, repeated results, lot transitions and rule-set changes.
3. Verify each evaluation snapshot preserves exact target values, units, LOT, levels, policy reference/version and engine version.
4. Test offline creation, browser restart, iOS storage pressure, export/import integrity and recovery.
5. Implement and test Supabase authentication, Row Level Security, append-only audit, cloud sync and conflict resolution before multi-device use.
6. Test database migrations against disposable databases; do not run the draft SQL against a production database.
7. Conduct security review and usability testing on the actual target iPhone.
8. Obtain responsible laboratory review and document approval before operational use.

A passing software smoke test is not clinical validation or accreditation evidence.
