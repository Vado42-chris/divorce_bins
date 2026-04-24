import xml.etree.ElementTree as ET
import json
import os
from flight_recorder import log_event
from datetime import datetime

XML_FILE = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/evidence/raw/test_sms.xml"
EXPORT_DIR = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/evidence/processed/sms"

def parse_sms_backup(xml_path=XML_FILE, out_dir=EXPORT_DIR):
    log_event("INFO", "SMS_Parser", f"Parsing SMS Archive: {xml_path}")
    if not os.path.exists(xml_path):
        log_event("ERROR", "SMS_Parser", f"File Not Found: {xml_path}")
        return
        
    os.makedirs(out_dir, exist_ok=True)
    tree = ET.parse(xml_path)
    root = tree.getroot()

    count = 0
    for sms in root.findall('sms'):
        # Android Timestamp Extraction (ms to s)
        ms_date = int(sms.get('date')) / 1000.0
        dt = datetime.fromtimestamp(ms_date)
        formatted_date = dt.strftime('%Y-%m-%d %H:%M:%S')

        address = sms.get('address')
        name = sms.get('contact_name') or sms.get('name') or address
        body = sms.get('body')
        msg_type = sms.get('type') # '1' = received, '2' = sent

        direction = "Received (Inbound)" if str(msg_type) == '1' else "Sent (Outbound)"

        filename = f"sms_{address}_{dt.strftime('%Y%m%d%H%M%S')}.md"
        filepath = os.path.join(out_dir, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("---\n")
            f.write(f"timestamp: {formatted_date}\n")
            f.write(f"sender: {name}\n")
            f.write(f"subject: Text Message ({direction})\n")
            f.write("type: sms\n")
            f.write(f"source: Android Backup\n")
            f.write("---\n\n")
            f.write(f"# Text Message: {direction}\n\n")
            f.write(f"**Contact:** {name} ({address})\n")
            f.write(f"**Date:** {formatted_date}\n")
            f.write(f"**Type:** {direction}\n\n")
            f.write("---\n\n")
            f.write(body.strip() if body else "[Attached Media/MMS]")

        count += 1
        print(f" [+] Extracted Thread Node: {filename}")

    print(f"\n--- SMS Pipeline Extraction Complete. Mapped {count} Android Records natively. ---")

if __name__ == '__main__':
    print("Initiating Mobile Exfiltration Engine...")
    parse_sms_backup()
