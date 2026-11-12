# Al-Israa QC Manager — 1.0.0 Unified Local Trial Candidate

Read `START_HERE_AR.md` first.

This is a local PWA trial candidate for QC-only workflows. It includes IndexedDB storage, offline shell caching after first HTTPS load, QC target and multi-level run entry, preliminary Westgard evaluation, device/analyte policy records, APS/TEa registry, Bias/Sigma helpers, calibration/EQA registers, manual scientific update log, local audit events and JSON backup/restore.

It is **not** production-ready or clinically validated. It has no Supabase/cloud sync, authentication, multi-user permissions, protected audit trail, automatic scientific-source monitoring, or direct analyzer/LIS integration. Do not enter patient-identifying data. Do not use it as the sole basis for operational QC decisions.

No QC limits, APS/TEa values, or enabled Westgard policies are seeded. Manufacturer and laboratory targets must be entered from documented sources and reviewed manually.
