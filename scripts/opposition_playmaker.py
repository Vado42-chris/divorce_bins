import json
import os

ARGUMENTS_PATH = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/metadata/arguments.json"

def analyze_gaps():
    """
    Identifies weaknesses in our own strategy and predicts opposition attacks.
    """
    if not os.path.exists(ARGUMENTS_PATH):
        return {"error": "Arguments index missing."}

    with open(ARGUMENTS_PATH, "r") as f:
        arguments = json.load(f)

    predictions = []

    for arg in arguments:
        strength = arg.get('strength', 50)
        anchors = len(arg.get('anchoredFacts', []))
        
        # Heuristic for weakness: Low strength OR few anchors
        if strength < 60 or anchors < 2:
            predictions.append({
                "argument_id": arg['id'],
                "theory": arg['title'],
                "vulnerability": "Insufficient corroborating evidence nodes.",
                "predicted_attack": f"Opposing counsel will likely claim this as 'Unsubstantiated Allegation' due to only {anchors} supporting record(s).",
                "risk_level": "HIGH" if strength < 40 else "MEDIUM"
            })

    return predictions

if __name__ == "__main__":
    print(json.dumps(analyze_gaps(), indent=2))
