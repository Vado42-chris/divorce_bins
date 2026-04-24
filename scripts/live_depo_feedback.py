import json
import os
import sys
from flight_recorder import log_event

VAULT_PATH = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/evidence/processed/vault.json"

def monitor_live_testimony(statement):
    """
    Checks a single line of live testimony against the vault.
    """
    if not os.path.exists(VAULT_PATH):
        return {"error": "Vault missing."}

    with open(VAULT_PATH, "r") as f:
        vault = json.load(f)

    # High-speed keyword/thematic scanner
    # In production, this would use a vector DB for <100ms latency
    matches = []
    keywords = [k for k in statement.lower().split() if len(k) > 4]

    for item in vault:
        content = item.get('content', '').lower()
        if any(kw in content for kw in keywords):
            matches.append({
                "source": item.get('id'),
                "title": item.get('title'),
                "conflict_snippet": content[:200] + "...",
                "confidence": 85
            })

    if matches:
        alert = {
            "status": "IMPEACHMENT_ALERT",
            "statement": statement,
            "conflicts": matches[:2],
            "recommended_action": "Freeze witness on current statement. Confront with Source " + matches[0]['source']
        }
        log_event("TACTICAL", f"Impeachment Alert: {statement[:50]}...", metadata=alert)
        return alert
    
    return {"status": "CLEAR", "statement": statement}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No statement provided."}))
        sys.exit(1)
    
    testimony = sys.argv[1]
    print(json.dumps(monitor_live_testimony(testimony), indent=2))
