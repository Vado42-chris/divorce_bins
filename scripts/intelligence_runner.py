import os
import json
import sys
import requests
import re
from datetime import datetime

# STRATEGIC LEGAL LEXICON
STRATEGIC_LEXICON = {
    "Section 7": ["section 7", "extraordinary expenses", "medical", "educational", "extracurricular"],
    "Financial Disclosure": ["form 13.1", "disclosure", "bank statements", "tax returns", "income"],
    "Access": ["access", "custody", "parenting time", "schedule", "pick up", "drop off"],
    "SGI Arbitration": ["sgi", "arbitration", "collision", "liability", "claim 16-892471"],
    "Legal Strategy": ["settlement", "without prejudice", "calderbank", "offer", "counter-offer"]
}

PROCESSED_DIR = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/evidence/processed"
INTELLIGENCE_FILE = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/metadata/intelligence.json"
OLLAMA_URL = "http://localhost:11434/api/generate"
RUNNER_LOCK_FILE = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/metadata/runner.lock"

def set_lock(active=True):
    if active:
        with open(RUNNER_LOCK_FILE, 'w') as f:
            f.write(datetime.now().isoformat())
    else:
        if os.path.exists(RUNNER_LOCK_FILE):
            os.remove(RUNNER_LOCK_FILE)

def analyze_file(file_id, file_path, model="llama3"):
    """Performs deep AIS analysis on a specific processed file."""
    set_lock(True)
    full_path = os.path.join(PROCESSED_DIR, file_path)
    if not os.path.exists(full_path):
        print(f"Error: File not found {full_path}")
        set_lock(False)
        return

    try:
        with open(full_path, 'r', errors='ignore') as f:
            content = f.read()

        prompt = f"""You are a specialized legal intelligence assistant trained in Saskatchewan Family Law and SGI (Saskatchewan Government Insurance) regulations.
        Analyze this piece of legal evidence for a Saskatchewan Family Law case with a concurrent SGI (Saskatchewan Government Insurance) Arbitration component. 
        PRIORITY ALERT: If this mentions Claim 16-892471 or 'Robert Henderson' or '2449 Eastview', or discusses vehicle valuation, collision liability, or Section 7 disputes, categorize as 'ARBITRATION' and flag for 'SGI LIABILITY'.
        
        Extract:
        1. A concise 1-sentence summary (summary).
        2. Factual events (dates/actions) (events).
        3. A conflict/severity score from 1-10 (score). High scores for credibility attacks, settlement threats, or liability shifts.
        4. Suggested Classification:
           - type: [FINANCIAL, MEDICAL, SMS, EMAIL, LEGAL, ARBITRATION, OTHER]
           - status: [VETTED, DISPUTED, UNVERIFIED]
           - confidence: A percentage (0-100) reflecting your certainty in this classification.
        
        Return ONLY a JSON object exactly matching this schema: 
        {{ "summary": "...", "events": ["..."], "score": 5, "entities": ["..."], "type": "...", "status": "...", "confidence": 85, "arbitration_metadata": {{ "claim_id": "...", "adjuster": "...", "incident_date": "...", "liability_assessment": "..." }} }}
        
        Content:
        {content[:4500]}"""

        response = requests.post(OLLAMA_URL, json={
            "model": model,
            "prompt": prompt,
            "stream": False
        }, timeout=60)
        
        data = response.json()
        analysis_text = data.get('response', '')
        
        # Extract JSON from response
        # Find the first { and last } to handle markdown blocks or preamble
        start_idx = analysis_text.find('{')
        end_idx = analysis_text.rfind('}')
        
        if start_idx != -1 and end_idx != -1:
            json_str = analysis_text[start_idx:end_idx+1]
            try:
                analysis = json.loads(json_str)
            except json.JSONDecodeError:
                # Try more aggressive cleaning if first pass fails
                json_str = re.sub(r'//.*?\n', '', json_str) # Remove comments
                analysis = json.loads(json_str)
            
            # Load existing intelligence
            intelligence = {}
            if os.path.exists(INTELLIGENCE_FILE):
                try:
                    with open(INTELLIGENCE_FILE, 'r') as f:
                        intelligence = json.load(f)
                except: intelligence = {}
            
            intelligence[file_id] = {
                **analysis,
                "timestamp": datetime.now().isoformat(),
                "model": model
            }
            
            with open(INTELLIGENCE_FILE, 'w') as f:
                json.dump(intelligence, f, indent=2)
            
            # Output for the backend to consume
            print(f"RESULT_JSON:{json.dumps(intelligence[file_id])}")
            print(f"Successfully analyzed {file_id}")
        else:
            print(f"Failed to parse JSON from AI response for {file_id}")

    except Exception as e:
        print(f"Error analyzing {file_id}: {e}")
    finally:
        set_lock(False)

def lexicon_tagger(text):
    """Tags text based on the STRATEGIC_LEXICON."""
    tags = []
    text_lower = text.lower()
    for category, keywords in STRATEGIC_LEXICON.items():
        if any(keyword in text_lower for keyword in keywords):
            tags.append(category)
    return tags

def extract_docket_id(text):
    """Extracts Docket ID from text using pattern [DOCK-XXXXXXXX]."""
    match = re.search(r'\[DOCK-([A-F0-9]{8})\]', text)
    return match.group(1) if match else None

def generate_narrative_arc(claims, model="llama3"):
    """Synthesizes multiple strategic claims into a cohesive narrative draft."""
    prompt = f"""You are a specialized legal strategist. 
    Review these strategic claims and draft a cohesive 'Factum/Statement of Truth' narrative summary.
    Focus on factual consistency, evidentiary grounding, and persuasive flow.
    
    Claims:
    {json.dumps(claims, indent=2)}
    
    Return ONLY a JSON object: {{ "narrative": "...", "keyThemes": ["..."], "strengths": ["..."] }}"""
    
    try:
        response = requests.post(OLLAMA_URL, json={"model": model, "prompt": prompt, "stream": False}, timeout=60)
        data = response.json()
        json_match = re.search(r'\{.*\}', data.get('response', ''), re.DOTALL)
        return json.loads(json_match.group(0)) if json_match else {"error": "Failed to parse narrative"}
    except Exception as e:
        print(f"Narrative error: {e}")
        return {"error": str(e)}

def simulate_cross_examination(vulnerability, model="llama3"):
    """Generates adversarial questioning based on a specific vulnerability."""
    prompt = f"""You are a aggressive opposing counsel in a high-conflict divorce deposition.
    Target this vulnerability in the user's case:
    {json.dumps(vulnerability, indent=2)}
    
    Generate 3-5 sharp, targeted questions (Attack Lines) designed to undermine their credibility or evidentiary weight.
    
    Return ONLY a JSON array of strings: ["Question 1", "Question 2", ...]"""
    
    try:
        response = requests.post(OLLAMA_URL, json={"model": model, "prompt": prompt, "stream": False}, timeout=60)
        data = response.json()
        json_match = re.search(r'\[.*\]', data.get('response', ''), re.DOTALL)
        return json.loads(json_match.group(0)) if json_match else ["Failed to generate attack lines"]
    except Exception as e:
        print(f"Cross-X error: {e}")
        return [f"Error: {str(e)}"]

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python intelligence_runner.py <mode> [args...]")
        sys.exit(1)
        
    mode = sys.argv[1]
    
    if mode == "--ping":
        print("STATUS: ONLINE")
        print(f"LOCK: {'ACTIVE' if os.path.exists(RUNNER_LOCK_FILE) else 'IDLE'}")
        sys.exit(0)
    
    if mode == "analyze":
        if len(sys.argv) < 4:
            print("Usage: python intelligence_runner.py analyze <file_id> <file_path> [model]")
            sys.exit(1)
        file_id = sys.argv[2]
        file_path = sys.argv[3]
        model = sys.argv[4] if len(sys.argv) > 4 else "llama3"
        analyze_file(file_id, file_path, model)
    elif mode == "narrative":
        # Expects claims as JSON string in sys.argv[2]
        claims = json.loads(sys.argv[2])
        model = sys.argv[3] if len(sys.argv) > 3 else "llama3"
        print(json.dumps(generate_narrative_arc(claims, model)))
    elif mode == "cross_x":
        # Expects vulnerability as JSON string in sys.argv[2]
        vuln = json.loads(sys.argv[2])
        model = sys.argv[3] if len(sys.argv) > 3 else "llama3"
        print(json.dumps(simulate_cross_examination(vuln, model)))
    else:
        print(f"Unknown mode: {mode}")
        sys.exit(1)
