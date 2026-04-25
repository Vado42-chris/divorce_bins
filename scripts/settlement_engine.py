import json
import os
from datetime import datetime

INTELLIGENCE_FILE = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/metadata/intelligence.json"
SETTLEMENT_REPORT = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/metadata/settlement_projections.json"

# Heuristic SGI Injury Scale (Simplified)
# Based on typical Saskatchewan non-pecuniary damage awards for minor/moderate injuries
SCALES = {
    "Low/Minor": (5000, 15000),
    "Moderate": (15000, 45000),
    "High/Severe": (45000, 120000),
    "Unknown": (0, 5000)
}

def calculate_projections():
    print("[SETTLEMENT] Initializing Financial Valuation Engine...")
    
    if not os.path.exists(INTELLIGENCE_FILE):
        return

    with open(INTELLIGENCE_FILE, 'r') as f:
        intelligence = json.load(f)

    # Aggregate SGI data
    sgi_nodes = [v for k, v in intelligence.items() if v.get('type') == 'ARBITRATION' or 'sgi' in str(v).lower()]
    
    # Heuristic Severity determination
    max_severity = "Unknown"
    icd_count = 0
    total_loss_detected = False
    
    for node in sgi_nodes:
        severity = node.get('sgi_metadata', {}).get('injurySeverity', 'Unknown')
        if severity == "High/Severe":
            max_severity = "High/Severe"
        elif severity == "Moderate" and max_severity != "High/Severe":
            max_severity = "Moderate"
        elif severity == "Low/Minor" and max_severity not in ["High/Severe", "Moderate"]:
            max_severity = "Low/Minor"
            
        icd_count += len(node.get('sgi_metadata', {}).get('icd_codes', []))
        if "total loss" in node.get('summary', '').lower():
            total_loss_detected = True

    base_range = SCALES[max_severity]
    
    # Adjusters
    multiplier = 1.0
    if icd_count > 3: multiplier += 0.2
    if total_loss_detected: multiplier += 0.1
    
    projected_min = base_range[0] * multiplier
    projected_max = base_range[1] * multiplier

    report = {
        "case_id": "SGI-ARB-2026",
        "primary_claim": "16-892471",
        "aggregate_severity": max_severity,
        "icd_diagnostic_weight": icd_count,
        "total_loss_incident": total_loss_detected,
        "projections": {
            "non_pecuniary_min": round(projected_min, 2),
            "non_pecuniary_max": round(projected_max, 2),
            "currency": "CAD"
        },
        "disclaimer": "Heuristic projection only. Based on typical Saskatchewan case law patterns for identified severity levels.",
        "generated_at": datetime.now().isoformat()
    }

    with open(SETTLEMENT_REPORT, 'w') as f:
        json.dump(report, f, indent=4)
        
    print(f"[SETTLEMENT] Projection report generated: {SETTLEMENT_REPORT}")

if __name__ == "__main__":
    calculate_projections()
