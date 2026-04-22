# Project Roadmap & Phase Tracking

This document outlines the evolutionary phases of the Legal Evidence Management Console (Divorce Bins). It must be kept strictly up to date with `task.md` completions to ensure AI-tool continuity.

## Completed Phases (Industrialization)

### Phase 1-3: Stabilization & Core Engine

* **Asset Optimization**: Built O(1) set-based lookups and implemented node-locking over evidence indexing.
* **Basic Vault**: UI for parsing standard legal evidence exports mapping to local `evidence/` drive.
* **Initial AI Identity**: Tied Ollama into semantic tracking to begin extracting sentiment flags.

### Phase 4: Relationship Mapping & Conflict Heatmap

* Formulated `api/analytics` endpoint for behavior aggregation.
* Mapped Key Actor relationships across communication logs in a structured Governance Center UI matrix.
* Dashboard inclusion of weekly heatmap aggregations.

### Phase 5: Advanced Reporting & Legal Exports

* Handled document detail level constraints (Summary vs. Comprehensive).
* Built an interactive frontend export wizard with live markdown rendering via `react-markdown`.
* Identity-filtered logic for targeted behavioral data extraction.

### Phase 6: Case Strategy Board & Argument Builder

* Transitioned raw data into tactical weapons by creating `arguments.json`.
* Implemented cross-platform Vault UI linking for nodes into logical argument silos.
* Standardized AI 'Legal Memo' drafting engine assigned to specific argument boundaries.

### Phase 7: Advanced Case Analytics & Narrative Synthesis

* Automated detection of anomalous communication velocity and volume spiking over time.
* Built full Chronological Narrative engine passing up to 40+ nodes to Ollama to synthesize massive contexts into timeline reports.

### Phase 8: Strategic Export Packaging (Industrial Grade)

* Completed backend `/api/export/bundle/:id` engine wrapping native ZIP outputs.
* Standardized professional `MEMO.md` creation combined with raw file attachments for attorneys.
* Automated centralizing and tracking of successful historically exported discovery bundles with one-click re-download options.

---

## Planned Future Phases (In Consideration)

### Phase 9: Cross-Reference Auditing & Truth Checking

* Implement automatic discrepancy checking across multi-party event descriptions using vector similarity.
* Build 'Contradiction Alerts' into the Governance Center.
* Add native `evidence/` OCR processing hook for scanned PDF documents.

### Phase 10: Trial Presentation Mode

* Lock-down read-only frontend mode for clean projection/presentation masking specific nodes dynamically.
* Full-screen chronological playback of Evidence nodes connected to a selected Argument.

### Phase 11: Deployment & Alpha Readiness (Friends & Family Release)

* **Digital Ingestion Wizard**: Replace Python scripts with a web UI allowing users to drag-and-drop structural MBOX/ZIP files or securely type IMAP credentials for automatic background syncing.
* **First-Run Onboarding Flow**: Build setup wizards to handle "Empty Vault" states so non-technical users know exactly how to start pulling in their data.
* **Standalone Packaging**: Containerize or package the Node.js backend, React frontend, and local Python/Ollama bindings into a 1-click installer (e.g., Electron `exe`/`dmg` or an automated Docker script).

*(Always review this roadmap and the architectural rules mapped in README.md before launching task commands.)*
