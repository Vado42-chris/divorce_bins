import json
import os
from datetime import datetime

VAULT_PATH = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/evidence/processed/vault.json"
ARGUMENTS_PATH = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/metadata/arguments.json"

def generate_lawyer_brief():
    """
    Synthesizes the entire case strategy into a professional Briefing Note.
    """
    if not os.path.exists(VAULT_PATH):
        return "# CASE BRIEFING ERROR\nVault not found. Please run indexer."

    with open(ARGUMENTS_PATH, "r") as f:
        arguments = json.load(f)

    brief = f"# EXECUTIVE CASE BRIEFING for Legal Counsel\n"
    brief += f"**Trial Readiness Date:** {datetime.now().strftime('%Y-%m-%d')}\n"
    brief += "**Case Title:** Family Maintenance / Property Division / SGI Contradiction Analysis\n\n"

    brief += "## 1. STRATEGIC OVERVIEW\n"
    brief += f"Total Evidence Nodes in Vault: {len(json.load(open(VAULT_PATH)))}\n"
    brief += f"Thematic Arguments Developed: {len(arguments)}\n\n"

    brief += "## 2. PRIMARY THEMES & STRENGTHS\n"
    for arg in sorted(arguments, key=lambda x: x.get('strength', 0), reverse=True)[:3]:
        brief += f"- **{arg['title']}** (Strength: {arg.get('strength', 0)}%)\n"
        brief += f"  - *Anchors:* {len(arg.get('anchoredFacts', []))} records.\n"

    brief += "\n## 3. KEY IMPEACHMENT OPPORTUNITIES\n"
    # Placeholder for automated impeachment extraction from contradictions.json
    brief += "- Activity Contradiction: Claims in SGI/Medical domain refuted by Family Law discovery.\n"
    brief += "- Financial Non-Disclosure: $1,500 + $2,000 transfers identified but missing from D-13.1 draft.\n"

    brief += "\n## 4. RECOMMENDATIONS\n"
    brief += "- Proceed with immediate deposition of Opposing Party focusing on 'Activity vs Disability' contradictions.\n"
    brief += "- Audit discovery bundle DB-0042 for additional undisclosed accounts.\n"

    return brief

if __name__ == "__main__":
    print(generate_lawyer_brief())
