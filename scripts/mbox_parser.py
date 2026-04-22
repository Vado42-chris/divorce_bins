import mailbox
import os
from datetime import datetime

def parse_mbox(mbox_file, output_dir, source_id="unknown"):
    print(f"Parsing Email MBOX: {mbox_file} (Source: {source_id})")
    mbox = mailbox.mbox(mbox_file)
    
    os.makedirs(output_dir, exist_ok=True)
    
    email_count = 0
    for message in mbox:
        subject = message['subject']
        sender = message['from']
        date_str = message['date']
        
        try:
            dt = datetime.strptime(date_str[:25].strip(), '%a, %d %b %Y %H:%M:%S')
            timestamp = dt.strftime('%Y-%m-%d %H:%M:%S')
            prefix = dt.strftime('%Y-%m-%d_%H%M%S')
        except:
            timestamp = "Unknown"
            prefix = f"email_{email_count}"

        content = ""
        if message.is_multipart():
            for part in message.walk():
                if part.get_content_type() == 'text/plain':
                    content += part.get_payload(decode=True).decode(errors='ignore')
        else:
            content = message.get_payload(decode=True).decode(errors='ignore')

        filename = f"{source_id}_{prefix}_{sender.replace('<', '').replace('>', '')[:20]}.md"
        
        md_content = f"""---
timestamp: {timestamp}
sender: {sender}
subject: {subject}
type: email
source: {source_id}
---

# Email: {subject}
**From:** {sender}
**Date:** {timestamp}
**Source:** {source_id}

---

{content}
"""
        with open(os.path.join(output_dir, filename), 'w') as f:
            f.write(md_content)
        email_count += 1

    print(f"Completed! Processed {email_count} emails into {output_dir}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 4:
        print("Usage: python3 mbox_parser.py <mbox_file> <output_dir> <source_id>")
    else:
        parse_mbox(sys.argv[1], sys.argv[2], sys.argv[3])
