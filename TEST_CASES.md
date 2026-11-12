# Engine test vectors — expected arithmetic checks

These are software test vectors, not clinical QC policy recommendations.

1. z-score: value 12, mean 10, SD 1 -> z = +2.
2. z-score: value 7, mean 10, SD 1 -> z = -3.
3. Sample statistics for [2,4,6]: mean 4, sample SD 2, CV 50%.
4. Sigma helper: TEa 10%, bias 2%, CV 2% -> Sigma 4.
5. Sigma must reject CV <= 0 and missing/non-numeric inputs.
6. 1_2S should create Warning, not Rejected, when it is the only triggered rule.
7. 1_3S should create Rejected.
8. 10X must require ten same-side results; mixed signs must not trigger.
9. Rule history must be chronological and scoped to the same target/level.
10. R_4S must not be inferred from one-level sequential values; it requires a validated multi-level same-run implementation.

A full automated test runner and independent reference verification remain pending.
