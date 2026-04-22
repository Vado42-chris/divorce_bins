import xml.etree.ElementTree as ET
import os
import json
from datetime import datetime

def parse_sms_backup(xml_file, output_dir, source_id="unknown"):
    print(f"Parsing SMS backup: {xml_file} (Source: {source_id})")
    tree = ET.parse(xml_file)
    root = tree.getroot()

    os.makedirs(output_dir, exist_ok=True)
    
    sms_count = 0
    for sms in root.findall('sms'):
        address = sms.get('address')
        date_ms = int(sms.get('date'))
        body = sms.get('body')
        type_code = sms.get('type') # 1 = received, 2 = sent
        
        dt = datetime.fromtimestamp(date_ms / 1000.0)
        timestamp = dt.strftime('%Y-%m-%d %H:%M:%S')
        filename = f"{source_id}_" + dt.strftime('%Y-%m-%d_%H%M%S') + f"_{address}.md"
        
        direction = "RECEIVED" if type_code == "1" else "SENT"
        
        md_content = f"""---
timestamp: {timestamp}
sender: {address}
type: sms
direction: {direction}
source: {source_id}
---

# SMS from {address}
**Time:** {timestamp}
**Direction:** {direction}
**Source:** {source_id}

{body}
"""
        with open(os.path.join(output_dir, filename), 'w') as f:
            f.write(md_content)
        sms_count += 1

    print(f"Completed! Processed {sms_count} messages into {output_dir}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 4:
        print("Usage: python3 sms_parser.py <xml_file> <output_dir> <source_id>")
    else:
        parse_sms_backup(sys.argv[1], sys.argv[2], sys.argv[3])
