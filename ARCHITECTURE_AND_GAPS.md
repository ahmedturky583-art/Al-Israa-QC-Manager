# Architecture and implementation status — 0.2.0

## Implemented locally
- RTL responsive web UI.
- IndexedDB local stores for devices, QC targets, QC runs, calibration logs, EQA logs and manually entered scientific updates.
- Service worker shell caching for offline reopening after the first successful online load.
- JSON export/import.
- Separate QC engine module with explicit single-level sequential rule evaluation for 1_2S, 1_3S, 2_2S, 4_1S and 10X.
- Basic sample statistics (sample SD and CV%) and Sigma calculation helper; these helpers are not yet exposed as a validated workflow in the UI.

## Still not implemented
- Supabase project connection, authentication, RLS, cloud sync and multi-device conflict resolution.
- Formal append-only audit log and cryptographic integrity controls.
- Multi-level R_4S evaluation. R_4S is deliberately not offered as a one-result rule.
- Full QC policy editor and approval workflow.
- APS specification registry with model/source/version validation and approval.
- Bias workflows tied to EQA/peer-group/comparison/reference-method evidence.
- Automated scientific-source monitoring.
- Automated backups to a separate cloud destination.
- Full analyzer-specific QC material catalog and analyte mappings.
- Automated statistical charts and validated Levey–Jennings plotting.
- Clinical/operational validation.

## Important semantic limitations
- 2_2S, 4_1S and 10X are currently evaluated on one target's chronological sequence only. They do not combine different QC levels or analytes.
- The engine accepts only the enabled rules explicitly supplied by the operator. No rules are enabled by default.
- The current UI permits recording target data before formal approval. This must be corrected with an approval gate before operational use.
- The local app has no user identity. "Entered by" and role-based permissions are not yet available.
