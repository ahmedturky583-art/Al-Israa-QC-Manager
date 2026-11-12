# Al-Israa QC Manager — 1.2.0 Unified Local Trial

Arabic RTL progressive web app for local QC workflow trials. Includes multi-analyte QC material entry and an in-app service-worker update prompt. Deploy as static assets to the existing Cloudflare Pages project using a new deployment of the extracted folder contents.

The update prompt appears when the browser detects a newly deployed service worker while online. The user chooses Update now or Later. Updating replaces cached application files and reloads the app; the IndexedDB database name/version are unchanged, so local records are retained by this update. Keep regular JSON backups regardless.

This remains a local trial candidate, not production-ready or clinically validated. No cloud sync, authentication, multi-user permissions, tamper-proof audit trail, automatic scientific-source monitoring, or analyzer/LIS integration. Do not enter patient-identifying data or use it as the sole basis for operational QC decisions.
