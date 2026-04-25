import json
import os
import re
from datetime import datetime

INTELLIGENCE_FILE = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/metadata/intelligence.json"
WARGAME_RESULTS = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/metadata/wargame_results.json"

def run_wargame():
    print("[WARGAME] Initializing Strategic Preemption Engine...")
    
    if not os.path.exists(INTELLIGENCE_FILE):
        print("[ERROR] Intelligence database not found.")
        return

    with open(INTELLIGENCE_FILE, 'r') as f:
        intelligence = json.load(f)

    results = {}
    
    # Identify SGI-related nodes
    sgi_nodes = {k: v for k, v in intelligence.items() if v.get('type') == 'ARBITRATION' or 'sgi' in str(v).lower()}
    
    print(f"[WARGAME] Analyzing {len(sgi_nodes)} SGI intelligence nodes...")

    for node_id, data in sgi_nodes.items():
        summary = data.get('summary', '')
        entities = data.get('entities', [])
        
        # Heuristic Strategic Analysis
        # In a full implementation, this could call an LLM for nuanced narrative generation.
        # Here we use pattern-based strategic extraction based on the user's specific case.
        
        adversarial_points = []
        counter_narratives = []
        
        if "total loss" in summary.lower() or "car-totaling" in summary.lower():
            adversarial_points.append("SGI may argue the vehicle value was lower due to pre-existing conditions or high mileage.")
            counter_narratives.append("Refer to maintenance records and recent appraisal (if available) to prove premium condition prior to collision.")
        
        if "liability" in summary.lower() or "collision" in summary.lower():
            adversarial_points.append("SGI might claim shared liability if the police report is ambiguous.")
            counter_narratives.append("Use witness statement (Cary Reid) and photo metadata to establish Katherine's exclusive control of the vehicle at the time of loss.")
            
        if "arbitration" in summary.lower():
            adversarial_points.append("Arbitration board may focus on the technical 'total loss' threshold (~80% of value).")
            counter_narratives.append("Emphasize the unique unavailability of replacement vehicles (market scarcity) to argue for replacement value over scrap value.")

        results[node_id] = {
            "node_id": node_id,
            "title": data.get('title', 'Unknown Node'),
            "adversarial_points": adversarial_points if adversarial_points else ["General skepticism regarding valuation thresholds."],
            "counter_narratives": counter_narratives if counter_narratives else ["Maintain strict adherence to chronological disclosure record."],
            "strategic_priority": "HIGH" if data.get('score', 0) > 7 else "MEDIUM",
            "last_analyzed": datetime.now().isoformat()
        }

    with open(WARGAME_RESULTS, 'w') as f:
        json.dump(results, f, indent=4)
        
    print(f"[WARGAME] Strategic analysis complete. Results saved to {WARGAME_RESULTS}")

if __name__ == "__main__":
    run_wargame()
