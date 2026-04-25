import os
import sys
import email
from email import policy
from datetime import datetime

def parse_eml_folder(input_dir, output_dir, source_id="legal_email"):
    print(f"Parsing EML Folder: {input_dir} -> {output_dir}")
    os.makedirs(output_dir, exist_ok=True)
    
    count = 0
    for filename in os.listdir(input_dir):
        if not filename.endswith('.eml'):
            continue
            
        file_path = os.path.join(input_dir, filename)
        try:
            with open(file_path, 'rb') as f:
                msg = email.message_from_binary_file(f, policy=policy.default)
            
            subject = msg.get('subject', 'No Subject')
            sender = msg.get('from', 'Unknown Sender')
            date_str = msg.get('date', '')
            
            # Simplified timestamp parsing
            try:
                # Typical format: Wed, 20 Apr 2026 04:40:34 +0000
                dt = email.utils.parsedate_to_datetime(date_str)
                timestamp = dt.strftime('%Y-%m-%d %H:%M:%S')
                prefix = dt.strftime('%Y-%m-%d_%H%M%S')
            except:
                timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                prefix = f"eml_{count}"

            content = ""
            if msg.is_multipart():
                for part in msg.walk():
                    if part.get_content_type() == 'text/plain':
                        content += part.get_content()
            else:
                content = msg.get_content()

            # Create sanitized filename
            safe_subject = "".join([c for c in subject if c.isalnum() or c in (' ', '-', '_')]).strip()[:30]
            out_filename = f"{source_id}_{prefix}_{safe_subject}.md"
            
            md_content = f"""---
timestamp: {timestamp}
sender: {sender}
subject: {subject}
type: email
source: {source_id}
status: discovery
---

# Email: {subject}
**From:** {sender}
**Date:** {timestamp}
**Source:** {source_id}

---

{content}
"""
            with open(os.path.join(output_dir, out_filename), 'w') as f:
                f.write(md_content)
            count += 1
            
        except Exception as e:
            print(f"Error parsing {filename}: {e}")

    print(f"Finished! Processed {count} emails.")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 eml_batch_parser.py <input_dir> <output_dir> [source_id]")
    else:
        s_id = sys.argv[3] if len(sys.argv) > 3 else "legal_email"
        parse_eml_folder(sys.argv[1], sys.argv[2], s_id)
