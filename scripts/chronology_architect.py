import json
import os
from datetime import datetime

METADATA_DIR = 'metadata'
ARGUMENTS_FILE = os.path.join(METADATA_DIR, 'arguments.json')
INDEX_FILE = os.path.join(METADATA_DIR, 'index.json')
OUTPUT_DIR = 'metadata/exports'

def build_master_chronology():
    if not os.path.exists(ARGUMENTS_FILE) or not os.path.exists(INDEX_FILE):
        return None

    with open(ARGUMENTS_FILE, 'r') as f:
        arguments = json.load(f)
    with open(INDEX_FILE, 'r') as f:
        index = json.load(f)

    # 1. Collect all events (Anchored Facts + High-Priority Evidence)
    events = []
    
    # Process Anchored Facts
    for arg in arguments:
        for fact in arg.get('anchoredFacts', []):
            events.append({
                "timestamp": fact.get('timestamp', '0000-00-00'),
                "title": fact.get('fact'),
                "source": fact.get('sourceTitle'),
                "type": "Anchored Fact",
                "strategy": arg.get('title'),
                "description": fact.get('description', '')
            })
            
    # Process "Flagged" Evidence from Index
    for item in index:
        if item.get('flagged') or item.get('priority') == 'high':
            events.append({
                "timestamp": item.get('timestamp', '0000-00-00'),
                "title": item.get('title', 'Evidence Node'),
                "source": item.get('source'),
                "type": "Priority Evidence",
                "strategy": "N/A",
                "description": item.get('summary', '')
            })

    # Sort Chronologically
    events.sort(key=lambda x: x['timestamp'])

    # 2. Synthesize into Narrative (Markdown)
    chronology_md = f"# 🗓️ Master Trial Chronology\n"
    chronology_md += f"*System Export: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*\n\n"
    
    chronology_md += "## 🎯 Strategic Summary\n"
    chronology_md += f"This document synthesizes **{len(events)}** verified evidentiary events. "
    chronology_md += "Events are sorted chronologically and mapped to active legal theories to ensure "
    chronology_md += "consistency during oral testimony and final submissions.\n\n"
    
    current_year = ""
    for event in events:
        year = event['timestamp'][:4]
        if year != current_year:
            chronology_md += f"## {year}\n"
            current_year = year
            
        chronology_md += f"### {event['timestamp']} | {event['title']}\n"
        chronology_md += f"- **Source:** {event['source']} ({event['type']})\n"
        if event['strategy'] != "N/A":
            chronology_md += f"- **Legal Theory:** {event['strategy']}\n"
        if event['description']:
            chronology_md += f"- **Detail:** {event['description']}\n"
        chronology_md += "\n"

    # Save Export
    target_path = os.path.join(OUTPUT_DIR, f"master_chronology_{datetime.now().strftime('%Y%m%d')}.md")
    with open(target_path, 'w') as f:
        f.write(chronology_md)
        
    return target_path

if __name__ == "__main__":
    path = build_master_chronology()
    if path:
        print(f"Chronology Created: {path}")
