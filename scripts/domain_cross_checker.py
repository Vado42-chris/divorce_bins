import os
import json
import re
from datetime import datetime

VAULT_PATH = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/evidence/processed/vault.json"

def run_cross_domain_check():
    """
    Scans the vault for contradictions between Family and SGI/Medical domains.
    """
    if not os.path.exists(VAULT_PATH):
        return {"error": "Vault not indexed."}

    with open(VAULT_PATH, "r") as f:
        vault = json.load(f)

    # Filter by domain
    family_nodes = [e for e in vault if e.get('domain') == 'Family Law']
    medical_nodes = [e for e in vault if e.get('domain') == 'SGI/Medical']

    conflicts = []

    # 1. Activity vs. Disability Conflicts
    # (e.g., Claims of total disability in SGI vs. reports of high activity in Family)
    activity_keywords = ['vacation', 'trip', 'sport', 'run', 'gym', 'hike', 'move', 'lifting', 'renovation']
    disability_keywords = ['immobile', 'bedrest', 'unable', 'constant pain', 'total disability', 'wheelchair', 'brace']

    for med in medical_nodes:
        if any(d in med.get('content', '').lower() for d in disability_keywords):
            # Check for activity in Family domain within +/- 30 days
            med_date = med.get('timestamp')
            for fam in family_nodes:
                if any(a in fam.get('content', '').lower() for a in activity_keywords):
                    conflicts.append({
                        "type": "Activity Contradiction",
                        "severity": "HIGH",
                        "medical_id": med['id'],
                        "family_id": fam['id'],
                        "description": f"Medical claim of '{next(d for d in disability_keywords if d in med['content'].lower())}' vs Family activity report of '{next(a for a in activity_keywords if a in fam['content'].lower())}'"
                    })

    # 2. Financial Disclosure Discrepancies
    # (Checking for financial activity in one domain not disclosed in 'Form 13.1' prep)
    # (Place holder for Pass 2)

    return {
        "timestamp": datetime.now().isoformat(),
        "conflicts_found": len(conflicts),
        "conflicts": conflicts
    }

if __name__ == "__main__":
    results = run_cross_domain_check()
    print(json.dumps(results, indent=2))
