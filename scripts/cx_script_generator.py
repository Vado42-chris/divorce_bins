import json
import os
from datetime import datetime

VAULT_PATH = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/evidence/processed/vault.json"
ARGUMENTS_PATH = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/metadata/arguments.json"

def generate_cx_script(witness_name):
    """
    Synthesizes contradictions into a structured CX/Deposition script.
    """
    # 1. Load Data
    if not os.path.exists(VAULT_PATH) or not os.path.exists(ARGUMENTS_PATH):
        return {"error": "Intelligence repositories missing."}

    with open(VAULT_PATH, "r") as f:
        vault = json.load(f)
    with open(ARGUMENTS_PATH, "r") as f:
        arguments = json.load(f)

    # 2. Identify Contradictions (Placeholder for combined contradiction logic)
    # In a real run, this would query witness_verifier.py and domain_cross_checker.py outputs
    
    script = {
        "witness": witness_name,
        "date_generated": datetime.now().isoformat(),
        "strategy": "Impeachment via Prior Inconsistent Statements",
        "questioning_blocks": []
    }

    # 3. Build Questioning Blocks from Gaps
    for arg in arguments:
        if arg.get('strength', 0) < 50:
            script["questioning_blocks"].append({
                "theme": f"Attack on {arg['title']}",
                "objective": "Highlight lack of evidentiary support for this claim.",
                "questions": [
                    f"You've stated in paragraph X that {arg['title']}, correct?",
                    "Where in the provided discovery is the proof for that statement?",
                    "Isn't it true that the vault records actually show the opposite?"
                ],
                "supporting_bates": [f.get('sourceId') for f in arg.get('anchoredFacts', [])]
            })

    return script

if __name__ == "__main__":
    import sys
    name = sys.argv[1] if len(sys.argv) > 1 else "Unknown Witness"
    print(json.dumps(generate_cx_script(name), indent=2))
