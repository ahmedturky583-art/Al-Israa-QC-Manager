# Multi-level QC rule handling

`evaluateR4sSameRun()` is a standalone helper. It requires at least two distinct QC levels belonging to the same analyte and same run, computes each level's z-score using its own target, and flags a pair only when their z-score difference is at least 4 SD and the signs are opposite.

The current UI still records one level/result at a time and does not call this helper. Therefore R4s is not yet active in the user workflow. A complete implementation must group all level readings into a single run, validate same-analyte/same-run pairing, retain the paired evidence in the immutable evaluation snapshot, and test missing/duplicate levels.
