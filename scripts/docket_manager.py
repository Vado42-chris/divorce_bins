import json
import os
import uuid
from datetime import datetime

DOCKETS_FILE = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/metadata/dockets.json"

class DocketManager:
    def __init__(self):
        self.ensure_storage()

    def ensure_storage(self):
        if not os.path.exists(DOCKETS_FILE):
            with open(DOCKETS_FILE, 'w') as f:
                json.dump([], f)

    def load_dockets(self):
        with open(DOCKETS_FILE, 'r') as f:
            return json.load(f)

    def save_dockets(self, dockets):
        with open(DOCKETS_FILE, 'w') as f:
            json.dump(dockets, f, indent=4)

    def create_docket(self, title, classification, linked_accounts=None):
        dockets = self.load_dockets()
        new_docket = {
            "id": str(uuid.uuid4())[:8],
            "title": title,
            "status": "ACTIVE",
            "classification": classification,
            "linked_accounts": linked_accounts or [],
            "created_at": datetime.now().isoformat(),
            "stats": {
                "evidence_count": 0,
                "arguments_count": 0,
                "risk_level": "LOW"
            },
            "primary_entities": []
        }
        dockets.append(new_docket)
        self.save_dockets(dockets)
        return new_docket

    def assign_to_docket(self, evidence_id, docket_id):
        # This will be called by the intelligence engine in the future
        # For now, it just validates the existence of the docket
        dockets = self.load_dockets()
        if any(d['id'] == docket_id for d in dockets):
            return True
        return False

if __name__ == "__main__":
    import sys
    manager = DocketManager()
    
    if len(sys.argv) > 1:
        action = sys.argv[1]
        if action == "create" and len(sys.argv) > 3:
            title = sys.argv[2]
            classification = sys.argv[3]
            print(json.dumps(manager.create_docket(title, classification)))
        elif action == "list":
            print(json.dumps(manager.load_dockets()))
