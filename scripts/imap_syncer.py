import imaplib
import email
import os
import json
from datetime import datetime

def sync_emails(host, user, password, output_dir, rules):
    print(f"Connecting to {host} in READ-ONLY mode...")
    mail = imaplib.IMAP4_SSL(host)
    mail.login(user, password)
    
    # Critical requirement: Non-destructive read
    mail.select("INBOX", readonly=True)
    
    # Simple fetch of recent messages for demonstration
    # In a real app, we would track last_uid
    result, data = mail.search(None, "ALL")
    ids = data[0].split()
    
    os.makedirs(output_dir, exist_ok=True)
    
    count = 0
    for i in ids[-50:]: # Just last 50 for safety in testing
        result, message_data = mail.fetch(i, "(RFC822)")
        raw_email = message_data[0][1]
        
        # Save as .eml (Raw Archive)
        filename = f"email_{i.decode()}.eml"
        with open(os.path.join(output_dir, filename), 'wb') as f:
            f.write(raw_email)
        count += 1
        
    mail.close()
    mail.logout()
    print(f"Archived {count} emails locally (READ-ONLY).")

if __name__ == "__main__":
    # Example usage (to be called by backend with credentials)
    # sync_emails('imap.gmail.com', 'user@gmail.com', 'app_password', '../evidence/raw', {})
    pass
