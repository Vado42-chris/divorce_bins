import os
import json
import time
import subprocess
from datetime import datetime

INTELLIGENCE_FILE = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/metadata/intelligence.json"
EMAILS_DIR = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/processed/emails"
SIGNAL_URL = "http://localhost:3001/api/stream/broadcast"

def get_file_stats():
    stats = {}
    if os.path.exists(INTELLIGENCE_FILE):
        stats['intel'] = os.path.getmtime(INTELLIGENCE_FILE)
    if os.path.exists(EMAILS_DIR):
        stats['emails'] = os.path.getmtime(EMAILS_DIR)
    return stats

def broadcast_event(event_type, item):
    """
    Simulates a signal to the Node server to broadcast via SSE.
    In a real system, this could be a webhook or a shared Redis queue.
    """
    payload = {
        "timestamp": datetime.now().isoformat(),
        "type": event_type,
        "item": item
    }
    # For now, we simulate by touching a signal file or making a local request
    # This keeps the Python-to-Node bridge simple
    try:
        data = json.dumps(payload)
        subprocess.run(["curl", "-X", "POST", "-H", "Content-Type: application/json", "-d", data, SIGNAL_URL], capture_output=True)
        print(f"Broadcasted {event_type}: {item.get('id', 'unknown')}")
    except Exception as e:
        print(f"Broadcast failed: {e}")

def monitor():
    print("Intelligence Broadcaster Active. Monitoring for new legal events...")
    last_stats = get_file_stats()
    
    while True:
        time.sleep(5) # Polling rate
        current_stats = get_file_stats()
        
        if current_stats.get('intel') != last_stats.get('intel'):
            print("New intelligence detected. Performing Lexicon scan...")
            # Here we would run the logic to extract the most recent item
            # and broadcast it as a 'NEW_INTELLIGENCE' event
            last_stats['intel'] = current_stats['intel']
            
        if current_stats.get('emails') != last_stats.get('emails'):
            print("New legal email discovered. Broadcasting to Decision Queue...")
            # Signal the frontend
            last_stats['emails'] = current_stats['emails']

if __name__ == "__main__":
    monitor()
