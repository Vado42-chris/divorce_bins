import json
import os
from datetime import datetime, timedelta

VAULT_PATH = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/evidence/processed/vault.json"

def calculate_velocity():
    """Calculates evidence ingestion velocity over the last 30 days."""
    if not os.path.exists(VAULT_PATH):
        return {"velocity": 0, "active_days": 0}
    
    with open(VAULT_PATH, "r") as f:
        vault = json.load(f)
    
    # Heuristic: Count items with timestamps in 'date' field
    now = datetime.now()
    month_ago = now - timedelta(days=30)
    
    count = 0
    for item in vault:
        # Simplistic date parsing for v4.1 heuristic
        try:
            val_date = datetime.strptime(item.get('date', '2020-01-01'), '%Y-%m-%d')
            if val_date > month_ago:
                count += 1
        except:
            continue
            
    return {
        "velocity": round(count / 4, 1), # items per week
        "total_nodes": len(vault),
        "status": "ACCELERATING" if count > 10 else "STABLE"
    }

if __name__ == "__main__":
    print(json.dumps(calculate_velocity()))
