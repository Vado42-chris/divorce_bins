import json
import os
import sys
from datetime import datetime, timedelta

INTELLIGENCE_FILE = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/metadata/intelligence.json"
EVIDENCE_FILE = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/metadata/index.json"

def correlate():
    if not os.path.exists(INTELLIGENCE_FILE) or not os.path.exists(EVIDENCE_FILE):
        return []

    with open(INTELLIGENCE_FILE, 'r') as f:
        intelligence = json.load(f)
    with open(EVIDENCE_FILE, 'r') as f:
        vault = json.load(f)

    patterns = []
    
    # Domain Mapping
    docs = {item['id']: item for item in vault}
    
    # 1. Temporal Collision Detection (Cross-Domain synchronization)
    # Group by date
    timeline = {}
    for item in vault:
        ts = item.get('timestamp')
        if not ts or not isinstance(ts, str):
            continue
            
        try:
            # Safe split and validation
            date_part = ts.split(' ')[0]
            if len(date_part) != 10: continue # YYYY-MM-DD check
            
            if date_part not in timeline: timeline[date_part] = []
            timeline[date_part].append(item['id'])
        except Exception:
            continue

    for date, ids in timeline.items():
        if len(ids) > 1:
            # Check different types
            types = set(docs[id]['type'] for id in ids)
            if len(types) > 1:
                patterns.append({
                    "type": "TEMPORAL_COLLISION",
                    "severity": "HIGH",
                    "date": date,
                    "ids": ids,
                    "message": f"Simultaneous events in {', '.join(types)} on {date}."
                })

    # 2. Semantic Keywords Linkage (Cross-referencing intelligence summaries)
    keywords = ["hospital", "surgery", "payment", "lawyer", "new", "car", "travel", "flight"]
    for kw in keywords:
        matches = []
        for fid, intel in intelligence.items():
            if kw in intel.get('summary', '').lower():
                matches.append(fid)
        
        if len(matches) > 1:
            patterns.append({
                "type": "SEMANTIC_LINK",
                "severity": "MEDIUM",
                "keyword": kw,
                "ids": matches,
                "message": f"Semantic link found across {len(matches)} items regarding '{kw}'."
            })

    return patterns

if __name__ == "__main__":
    results = correlate()
    print(json.dumps(results, indent=2))
