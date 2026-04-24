import json
import os
from datetime import datetime

LOG_FILE = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/metadata/flight_recorder.log"

def log_event(level, component, message, metadata=None):
    """
    Writes a forensic JSON event to the Flight Recorder log.
    Levels: INFO, WARNING, ERROR, CRITICAL
    """
    event = {
        "timestamp": datetime.now().isoformat(),
        "level": level.upper(),
        "component": component,
        "message": message,
        "metadata": metadata or {}
    }
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    
    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(event) + "\n")
    
    # Also print to stdout for Node.js process capture if needed
    if level.upper() in ["ERROR", "CRITICAL"]:
        print(f"!!! [{level.upper()}] {component}: {message}")
    else:
        print(f"[{level.upper()}] {component}: {message}")

if __name__ == "__main__":
    log_event("INFO", "FlightRecorder", "Log system initialization successful.")
