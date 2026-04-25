import json
import os

JURISDICTIONS = {
    "Ontario": {
        "financial_statement": "Form 13.1",
        "net_family_property": "Form 13B",
        "required_docs": ["Bank Statements", "Tax Returns", "Notice of Assessments", "Pay Stubs"]
    },
    "British Columbia": {
        "financial_statement": "Form F8",
        "required_docs": ["Bank Statements", "Income Tax Returns", "Property Assessments"]
    },
    "United Kingdom": {
        "financial_statement": "Form E",
        "required_docs": ["Bank Statements", "P60", "Pension Valuations"]
    }
}

class JurisdictionManager:
    def __init__(self, metadata_path="metadata/jurisdiction.json"):
        self.metadata_path = metadata_path
        self.active_jurisdiction = self._load()

    def _load(self):
        if os.path.exists(self.metadata_path):
            with open(self.metadata_path, 'r') as f:
                return json.load(f).get("active", "Ontario")
        return "Ontario"

    def set_jurisdiction(self, name):
        if name in JURISDICTIONS:
            self.active_jurisdiction = name
            with open(self.metadata_path, 'w') as f:
                json.dump({"active": name}, f)
            return True
        return False

    def get_requirements(self):
        return JURISDICTIONS.get(self.active_jurisdiction)

if __name__ == "__main__":
    jm = JurisdictionManager()
    print(json.dumps(jm.get_requirements(), indent=2))
