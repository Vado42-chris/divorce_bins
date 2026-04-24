# ⚖️ Production Handover: Divorce Bins Evidence Vault v2.1.0

The platform is now in a production-hardened state, optimized for high-stakes legal evidence management.

## 🚀 Service Management

The application is orchestrated by PM2. Use the following commands to manage the services:

- **Check Status**: `pm2 status`
- **View Logs**: `pm2 logs`
- **Restart All**: `pm2 restart all`
- **Stop All**: `pm2 stop all`

## 🧠 Pre-Trial Intelligence Tools

The following specialized engines are now fully integrated and accessible via the **Legal Hub** on the Dashboard:

1. **Master Trial Chronology**: Synthesizes verified facts into a sorted timeline (`metadata/exports/chronology_*.md`).
2. **Narrative Cohesion Audit**: Scans for "Weak Theories" and orphaned evidence (`metadata/exports/audit_*.md`).
3. **Deposition/CX Strategist**: Generates leading "Yes/No" cross-examination questions in the Conflict Hub.
4. **Witness Parser**: Automatically identifies declarants and numbered paragraph facts from affidavits.

## 🩺 System Health & Maintenance

- **Health Endpoint**: `http://localhost:3001/health` (Uptime, Memory, Node Counts).
- **Backups**: Weekly backups of the `/metadata/` and `metadata/database/` directories are ESSENTIAL.
- **Log Rotation**: Automated rotation is enabled (30-day retention).

## 🛡️ Stability Governance

- **Self-Healing**: PM2 restarts crashed processes within 3s.
- **Memory Gating**: Workers restart if RAM usage exceeds 500MB (prevents freezes during heavy OCR/LLM jobs).
- **Hardened UI**: "PROD SEAL v2.1.0" indicates active governance and truth-checking active.

---
*Final Hardening Complete: April 23, 2026*
