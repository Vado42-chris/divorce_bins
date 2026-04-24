import os
import json
import re
from datetime import datetime

VAULT_PATH = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/evidence/processed/vault.json"

def run_credibility_check(affidavit_data):
    """
    Cross-references affidavit paragraphs against vault communications to find contradictions.
    """
    if not os.path.exists(VAULT_PATH):
        return {"error": "Vault not indexed."}

    with open(VAULT_PATH, "r") as f:
        vault = json.load(f)

    results = {
        "declarant": affidavit_data.get("declarant", "Unknown"),
        "total_paragraphs": len(affidavit_data.get("paragraphs", [])),
        "contradiction_leads": [],
        "verified_statements": []
    }

    # Focus on communications for the same declarant
    comm_records = [e for e in vault if e.get('domain') in ['SMS', 'Email']]

    for i, para in enumerate(affidavit_data.get("paragraphs", [])):
        # Extract keywords for thematic matching
        keywords = [w for w in re.findall(r'\b\w{6,}\b', para) if w.lower() not in ['mother', 'father', 'children']]
        
        matches = []
        for rec in comm_records:
            match_score = sum(1 for k in keywords if k.lower() in rec.get('summary', '').lower() or k.lower() in rec.get('content', '').lower())
            if match_score > 1: # High thematic overlap
                matches.append({
                    "id": rec['id'],
                    "title": rec['title'],
                    "score": match_score,
                    "preview": rec.get('summary', rec.get('content', ''))[:100] + "..."
                })
        
        if matches:
            results["contradiction_leads"].append({
                "paragraph_num": i + 1,
                "statement": para[:150] + "...",
                "vault_matches": sorted(matches, key=lambda x: x['score'], reverse=True)[:3]
            })

    return results

if __name__ == "__main__":
    # Test logic
    sample_witness = {
        "declarant": "John Doe",
        "paragraphs": [
            "I have never contacted the opposing party regarding child support prior to 2024.",
            "That on the night of August 15, I was at home alone."
        ]
    }
    print(json.dumps(run_credibility_check(sample_witness), indent=2))
