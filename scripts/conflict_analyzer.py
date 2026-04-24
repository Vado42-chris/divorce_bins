import json
import os
import sys
from datetime import datetime, timedelta

METADATA_DIR = 'metadata'
SOURCES_FILE = os.path.join(METADATA_DIR, 'sources.json')
CONFLICTS_FILE = os.path.join(METADATA_DIR, 'conflicts.json')

def analyze_conflicts():
    if not os.path.exists(SOURCES_FILE):
        return
    
    with open(SOURCES_FILE, 'r') as f:
        evidence = json.load(f)
    
    conflicts = []
    
    # Example Logic: Correlate "I'm broke" or "at home" claims with contradictory records
    # Pass 1: Time-Spatial Contradiction (SMS vs Financial)
    # This is a heuristic engine that will scale as we add more financial templates
    
    for item in evidence:
        # 1. Identify "Location/Status" claims in strings
        summary = (item.get('summary') or item.get('title') or "").lower()
        
        # Heuristic keywords for location/activity
        if any(kw in summary for kw in ["home", "sleeping", "working", "driving"]):
            ts_str = item.get('timestamp')
            if not ts_str: continue
            
            try:
                ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
            except: continue
                
            # Cross-reference with other evidence within +/- 1 hour
            for peer in evidence:
                if peer['id'] == item['id']: continue
                peer_ts_str = peer.get('timestamp')
                if not peer_ts_str: continue
                
                try:
                    p_ts = datetime.fromisoformat(peer_ts_str.replace('Z', '+00:00'))
                except: continue
                    
                diff = abs((ts - p_ts).total_seconds())
                if diff < 3600: # Within 1 hour
                    # Check for contradiction indicators
                    # (Simplified for Pass 1: Flag any dense activity overlapping with a claim of 'sleeping' or 'home')
                    if "sleeping" in summary and peer.get('type') == 'FINANCIAL':
                        conflicts.append({
                            "id": f"c-{item['id']}-{peer['id']}",
                            "type": "CHRONOLOGICAL_CONTRADICTION",
                            "severity": "HIGH",
                            "description": f"Target claimed to be 'sleeping', but financial activity detected within 60 minutes.",
                            "nodes": [item['id'], peer['id']],
                            "timestamp": datetime.now().toISOString()
                        })
    
    with open(CONFLICTS_FILE, 'w') as f:
        json.dump(conflicts, f, indent=2)

if __name__ == "__main__":
    analyze_conflicts()
    print("Conflict Analysis Complete.")
