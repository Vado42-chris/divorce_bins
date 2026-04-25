import imaplib
import email
import json
import os
import re
from datetime import datetime
from email.header import decode_header

# Constants
METADATA_DIR = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/metadata"
EMAIL_STORAGE = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/evidence/emails"
CONFIG_FILE = os.path.join(METADATA_DIR, "email_config.json")

class SovereignEmailIngress:
    def __init__(self):
        self.ensure_dirs()
        self.config = self.load_config()

    def ensure_dirs(self):
        os.makedirs(METADATA_DIR, exist_ok=True)
        os.makedirs(EMAIL_STORAGE, exist_ok=True)

    def load_config(self):
        if not os.path.exists(CONFIG_FILE):
            # Create a placeholder for the user to fill (safe defaults)
            placeholder = {
                "accounts": [
                    {
                        "name": "Primary Legal",
                        "imap_server": "imap.gmail.com",
                        "username": "user@example.com",
                        "password": "app-password-here",
                        "status": "PENDING_CONFIGURATION"
                    }
                ]
            }
            with open(CONFIG_FILE, 'w') as f:
                json.dump(placeholder, f, indent=4)
            return placeholder
        with open(CONFIG_FILE, 'r') as f:
            return json.load(f)

    def fetch_headers(self, account_index=0, limit=10):
        """Fetches recent headers WITHOUT deleting anything."""
        acc = self.config["accounts"][account_index]
        if acc["status"] == "PENDING_CONFIGURATION":
            return {"error": "Account not configured"}

        try:
            mail = imaplib.IMAP4_SSL(acc["imap_server"])
            mail.login(acc["username"], acc["password"])
            mail.select("inbox")
            
            # Search for all emails
            status, messages = mail.search(None, "ALL")
            email_ids = messages[0].split()
            
            headers = []
            for e_id in email_ids[-limit:]: # Get the last 'limit' emails
                res, msg_data = mail.fetch(e_id, "(RFC822)")
                for response_part in msg_data:
                    if isinstance(response_part, tuple):
                        msg = email.message_from_bytes(response_part[1])
                        subject = self.decode_str(msg["Subject"])
                        from_ = self.decode_str(msg["From"])
                        date_str = msg["Date"]
                        
                        # Extract Docket ID from subject if present
                        docket_match = re.search(r'\[DOCK-([A-F0-9]{8})\]', subject)
                        docket_id = docket_match.group(1) if docket_match else None

                        headers.append({
                            "id": e_id.decode(),
                            "account": acc["name"],
                            "subject": subject,
                            "from": from_,
                            "date": date_str,
                            "docket_id": docket_id,
                            "source_ref": f"imap://{acc['username']}/{e_id.decode()}"
                        })
            mail.logout()
            return headers
        except Exception as e:
            return {"error": f"IMAP Error: {str(e)}"}

    def decode_str(self, s):
        if not s: return ""
        decoded_bytes, charset = decode_header(s)[0]
        if isinstance(decoded_bytes, bytes):
            return decoded_bytes.decode(charset or "utf-8")
        return decoded_bytes

if __name__ == "__main__":
    ingress = SovereignEmailIngress()
    print(json.dumps(ingress.fetch_headers()))
