import json
import os
from datetime import datetime

KB_DIR = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/metadata/legal_kb"
INDEX_PATH = os.path.join(KB_DIR, "kb_index.json")

def ingest_legal_artifact(file_path, artifact_type="precedent"):
    """
    Ingests a legal document into the knowledge base index.
    """
    if not os.path.exists(KB_DIR):
        os.makedirs(KB_DIR)

    if not os.path.exists(INDEX_PATH):
        index = []
    else:
        with open(INDEX_PATH, "r") as f:
            index = json.load(f)

    # Basic metadata extraction
    filename = os.path.basename(file_path)
    with open(file_path, "r") as f:
        content = f.read()

    # In a real run, this would use AI to summarize the 'Core Holding' of the case
    new_entry = {
        "id": f"LKB-{len(index) + 1:04d}",
        "title": filename.replace("_", " ").split(".")[0].title(),
        "type": artifact_type,
        "path": file_path,
        "date_ingested": datetime.now().isoformat(),
        "summary": "AI summary pending...",
        "tags": ["saskatchewan", "family_law"] if artifact_type == "precedent" else ["sgi", "policy"]
    }

    index.append(new_entry)

    with open(INDEX_PATH, "w") as f:
        json.dump(index, f, indent=2)

    return new_entry

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python lkb_ingestor.py <file_path> <type>")
        sys.exit(1)
    
    path = sys.argv[1]
    atype = sys.argv[2] if len(sys.argv) > 2 else "precedent"
    result = ingest_legal_artifact(path, atype)
    print(f"Ingested: {result['title']} as {result['id']}")
