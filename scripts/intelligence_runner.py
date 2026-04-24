import os
import json
import sys
import requests
import re
from datetime import datetime

PROCESSED_DIR = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/evidence/processed"
INTELLIGENCE_FILE = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/metadata/intelligence.json"
OLLAMA_URL = "http://localhost:11434/api/generate"

def analyze_file(file_id, file_path, model="llama3"):
    full_path = os.path.join(PROCESSED_DIR, file_path)
    if not os.path.exists(full_path):
        print(f"Error: File not found {full_path}")
        return

    try:
        with open(full_path, 'r', errors='ignore') as f:
            content = f.read()

        prompt = f"""You are a specialized legal intelligence assistant trained in Saskatchewan Family Law, Canadian Disability Law, and SGI (Saskatchewan Government Insurance) regulations.
        Analyze this piece of legal evidence. 
        Extract:
        1. A concise 1-sentence summary interpreting the interaction through the lens of Saskatchewan legal frameworks.
        2. Factual events (dates/actions) mentioned.
        3. A conflict/severity score from 1-10 (10 being high conflict or severe impact).
        4. Any mentioned names/entities not already known.
        
        Return ONLY a JSON object exactly matching this schema without any markdown wrapping: {{ "summary": "...", "events": ["..."], "score": 5, "entities": ["..."] }}
        
        Content:
        {content[:4000]}"""

        response = requests.post(OLLAMA_URL, json={
            "model": model,
            "prompt": prompt,
            "stream": False
        })
        
        data = response.json()
        analysis_text = data.get('response', '')
        
        # Extract JSON from response
        json_match = re.search(r'\{.*\}', analysis_text, re.DOTALL)
        if json_match:
            analysis = json.loads(json_match.group(0))
            
            # Load existing intelligence
            intelligence = {}
            if os.path.exists(INTELLIGENCE_FILE):
                with open(INTELLIGENCE_FILE, 'r') as f:
                    intelligence = json.load(f)
            
            intelligence[file_id] = {
                **analysis,
                "timestamp": datetime.now().isoformat(),
                "model": model
            }
            
            with open(INTELLIGENCE_FILE, 'w') as f:
                json.dump(intelligence, f, indent=2)
            
            print(f"Successfully analyzed {file_id}")
        else:
            print(f"Failed to parse JSON from AI response for {file_id}")

    except Exception as e:
        print(f"Error analyzing {file_id}: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python intelligence_runner.py <file_id> <file_path> [model]")
    else:
        fid = sys.argv[1]
        fpath = sys.argv[2]
        mdl = sys.argv[3] if len(sys.argv) > 3 else "llama3"
        analyze_file(fid, fpath, mdl)
