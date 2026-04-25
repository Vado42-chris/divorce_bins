import json
import os
import sys
from datetime import datetime

# Import Flight Recorder if possible
try:
    from flight_recorder import logToFlightRecorder
except ImportError:
    def logToFlightRecorder(msg, level='INFO'): pass # Silenced for API compatibility

VAULT_INDEX = "metadata/index.json"
OUTPUT_DIR = "metadata/exports"

def generate_form_13_1_draft():
    """
    Aggregates financial data from the vault and produces a Form 13.1 Draft Manifest.
    """
    logToFlightRecorder("Initiating Form 13.1 Draft Generation...")
    
    if not os.path.exists(VAULT_INDEX):
        logToFlightRecorder("Vault index missing. Aborting.", "ERROR")
        return {"error": "Index not found"}

    with open(VAULT_INDEX, 'r') as f:
        index = json.load(f)

    draft = {
        "metadata": {
            "title": "Form 13.1 Financial Statement (Draft)",
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": "DRAFT_INTERNAL"
        },
        "sections": {
            "PART_1_ASSETS": [],
            "PART_2_DEBTS": [],
            "PART_3_INCOME": [],
            "PART_4_EXPENSES": []
        },
        "evidence_anchors": []
    }

    # Scan for financial documents and OCR data
    for entry in index:
        # Example tag: financial, bank_statement, tax_return
        if entry.get('domain') == 'Family Law' or entry.get('type') == 'document':
             # Here we would normally plug in the financial_parser results.
             # For Phase 49 start, we will aggregate metadata.
             if 'statement' in entry.get('title', '').lower():
                 draft["evidence_anchors"].append({
                     "id": entry.get('id'),
                     "title": entry.get('title'),
                     "path": entry.get('path'),
                     "status": "VERIFIED" if entry.get('status') == 'vault' else "PENDING"
                 })

    # Save draft manifest
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    draft_filename = f"form_13_1_draft_{timestamp}.json"
    draft_path = os.path.join(OUTPUT_DIR, draft_filename)
    
    with open(draft_path, 'w') as f:
        json.dump(draft, f, indent=2)

    logToFlightRecorder(f"Form 13.1 Draft saved: {draft_filename}")
    return {"success": True, "filename": draft_filename, "path": draft_path}

if __name__ == "__main__":
    res = generate_form_13_1_draft()
    print(json.dumps(res))
