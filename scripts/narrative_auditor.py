import json
import os
from datetime import datetime

METADATA_DIR = 'metadata'
ARGUMENTS_FILE = os.path.join(METADATA_DIR, 'arguments.json')
INDEX_FILE = os.path.join(METADATA_DIR, 'index.json')
OUTPUT_DIR = 'metadata/exports'

def run_narrative_audit():
    if not os.path.exists(ARGUMENTS_FILE) or not os.path.exists(INDEX_FILE):
        return None

    with open(ARGUMENTS_FILE, 'r') as f:
        arguments = json.load(f)
    with open(INDEX_FILE, 'r') as f:
        index = json.load(f)

    audit_results = {
        "timestamp": datetime.now().isoformat(),
        "total_arguments": len(arguments),
        "total_evidence_nodes": len(index),
        "critical_gaps": [],
        "orphaned_evidence": [],
        "weak_theories": []
    }

    # 1. Identify Orphaned Evidence (High priority nodes not in any argument)
    linked_item_ids = set()
    for arg in arguments:
        linked_item_ids.update(arg.get('items', []))
    
    for item in index:
        if (item.get('priority') == 'high' or item.get('flagged')) and item.get('id') not in linked_item_ids:
            audit_results["orphaned_evidence"].append({
                "id": item.get('id'),
                "title": item.get('title'),
                "reason": "High-priority node not mapped to any Strategic Argument"
            })

    # 2. Identify Weak Theories (Arguments with < 2 facts)
    for arg in arguments:
        if len(arg.get('items', [])) < 2:
            # AI Remediation Step: Find best potential matches in index
            keywords = arg.get('title', '').split()
            potential_matches = [e for e in index if e.get('id') not in linked_item_ids and any(k.lower() in e.get('title', '').lower() for k in keywords if len(k) > 4)]
            
            audit_results["weak_theories"].append({
                "id": arg.get('id'),
                "title": arg.get('title'),
                "warning": "Argument has insufficient evidentiary anchoring (less than 2 facts)",
                "remediation": f"Link to candidate records: {', '.join([m['id'] for m in potential_matches[:3]])}" if potential_matches else "Discovery required: No thematic matches found in vault."
            })
            
    # 3. Identify Synthesis Gaps (Missing Memos)
    for arg in arguments:
        if not arg.get('legalMemo'):
            audit_results["critical_gaps"].append({
                "id": arg.get('id'),
                "title": arg.get('title'),
                "issue": "Strategic Memo has not been synthesized"
            })

    # Generate Report (Markdown)
    report_md = "# ⚖️ Pre-Trial Narrative Cohesion Audit\n"
    report_md += f"*Audit Instance: {datetime.now().strftime('%Y-%m-%d %H:%M')}*\n"
    report_md += f"*Status: PRODUCTION HARDENED*\n\n"
    
    report_md += "> [!IMPORTANT]\n"
    report_md += "> This audit identifies logical gaps and evidentiary 'orphan' states. A 'Weak Theory' flag suggests the argument may not survive cross-examination without further factual anchoring.\n\n"
    
    if audit_results["critical_gaps"]:
        report_md += "## 🚨 CRITICAL SYNTHESIS GAPS\n"
        for gap in audit_results["critical_gaps"]:
            report_md += f"- **{gap['title']}**: {gap['issue']}\n"
        report_md += "\n"

    if audit_results["orphaned_evidence"]:
        report_md += "## 🔍 ORPHANED HIGH-PRIORITY EVIDENCE\n"
        report_md += "The following records have HIGH strategic value but NO mapping to a Legal Theory:\n"
        for item in audit_results["orphaned_evidence"]:
            report_md += f"- **{item['title']}** (Node: `{item['id']}`)\n"
        report_md += "\n"

    if audit_results["weak_theories"]:
        report_md += "## ⚠️ Evidentiary Weaknesses\n"
        report_md += "These legal theories are under-supported by the current data set:\n"
        for theory in audit_results["weak_theories"]:
            report_md += f"- **{theory['title']}**\n"
            report_md += f"  - *Issue*: {theory['warning']}\n"
            if 'remediation' in theory:
                report_md += f"  - [REMEDIATION]: {theory['remediation']}\n"
        report_md += "\n"

    # Save
    report_path = os.path.join(OUTPUT_DIR, f"narrative_audit_{datetime.now().strftime('%Y%m%d_%H%M')}.md")
    if not os.path.exists(OUTPUT_DIR): os.makedirs(OUTPUT_DIR)
    with open(report_path, 'w') as f:
        f.write(report_md)
        
    return report_path

if __name__ == "__main__":
    path = run_narrative_audit()
    if path:
        print(f"Audit Complete: {path}")
