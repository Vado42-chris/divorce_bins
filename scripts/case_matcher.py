import json
import os

KB_INDEX = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/metadata/legal_kb/kb_index.json"
ARGUMENTS_PATH = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/metadata/arguments.json"

def match_cases():
    """
    Matches internal args to legal precedents.
    """
    if not os.path.exists(KB_INDEX) or not os.path.exists(ARGUMENTS_PATH):
        return {"error": "Knowledge Base or Arguments missing."}

    with open(KB_INDEX, "r") as f:
        kb = json.load(f)
    with open(ARGUMENTS_PATH, "r") as f:
        arguments = json.load(f)

    matches = []

    for arg in arguments:
        for ref in kb:
            # Heuristic match for testing (should be AI-vindexed in production)
            if any(tag in arg['title'].lower() for tag in ref.get('tags', [])):
                matches.append({
                    "argument_id": arg['id'],
                    "precedent_id": ref['id'],
                    "precedent_title": ref['title'],
                    "match_type": "Thematic Overlap",
                    "strength": 85
                })

    return matches

if __name__ == "__main__":
    print(json.dumps(match_cases(), indent=2))
