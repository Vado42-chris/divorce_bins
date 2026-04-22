# Divorce Bins | Secure Legal Evidence Vault

An industrial-grade, AI-driven legal evidence management console built for precision discovery, case strategy formulation, and secure data handling.

## Architecture

* **Frontend**: React + Vite (Port 5174) with a modern, glass-morphism dark-mode UI.
* **Backend**: Node.js + Express (Port 3001) for file system operations, API endpoints, and metadata management.
* **AI Engine**: Local Ollama instance (`llama3.1:8b`) mapped securely via backend for chronological narration, intelligent memo generation, and semantic analysis (No PII is sent to external cloud APIs).
* **Persistence**: File-based JSON persistence in `metadata/` mapped directly to disk to avoid complex SQL dependencies and guarantee absolute data control, supporting massive raw evidence files located in `evidence/`.

## Core Features

1. **Secure Vault**: Browse, tag, and organize harvested EML/XML/MBOX/PDF data.
2. **Strategy Hub**: Formulate legal arguments, link specific evidentiary nodes to them, and auto-generate AI synthesis 'Memos'.
3. **Governance Center**: Identify Key Actors (Identities), track their behavioral/communication velocity (Heatmaps), and get active pattern detection alerts.
4. **Reports & Exports**: Generate customized PDF/Markdown disclosure formats, and fully export 'Argument Bundles' to zip files for attorneys containing standard proofs and synthetic tactical memos.

## Project Structure

* `/src`: Frontend React application.
* `/server.js`: Central Express server, handles FS manipulation, export engine wrapping, and API definitions.
* `/scripts`: Python extraction/parsing tools for IMAP harvesting, MBOX parsing, and initial AI index generation (`intelligence_runner.py`, `index_generator.py`).
* `/metadata`: Local persistence databases (`arguments.json`, `sources.json`, `identities.json`).
* `/evidence`: Air-gapped location for large RAW evidence, structured by parsed outputs.
* `/exports`: Generated zip discovery bundles.

## Running the Application

1. **AI Dependency**: Ensure Ollama is running locally: `ollama run llama3.1:8b`
2. **Backend**: From the terminal, run `node server.js` (operates on port 3001).
3. **Frontend**: In a separate terminal, run `npm run dev` (operates on port 5174).

## Hand-off Protocol for AI Systems

If taking over development from a previous context:

1. Review this `README.md` and the `ROADMAP.md` before executing new architecture instructions.
2. Rely heavily on the `metadata/*.json` objects to understand data schemas.
3. Honor existing port mappings to avoid resource conflicts.

See `ROADMAP.md` for current and future phase trajectory.
