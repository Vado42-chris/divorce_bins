import imaplib
import email
from email.header import decode_header
import os
import re
from datetime import datetime

EXPORT_DIR = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/evidence/processed/emails"

def decode_mime_words(s):
    if not s: return ""
    return u''.join(
        word.decode(charset or 'utf-8') if isinstance(word, bytes) else word
        for word, charset in decode_header(s)
    )

def extract_body(msg):
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            cdispo = str(part.get('Content-Disposition'))
            if ctype == 'text/plain' and 'attachment' not in cdispo:
                try:
                    return part.get_payload(decode=True).decode()
                except:
                    pass
    else:
        try:
            return msg.get_payload(decode=True).decode()
        except:
            pass
    return "Body extraction failed. Raw extraction only."

def sync_emails_to_vault(host, user, password, limit=50):
    print(f"Connecting Vault IMAP Tunnel to {host} [READ-ONLY]...")
    mail = imaplib.IMAP4_SSL(host)
    mail.login(user, password)
    mail.select("INBOX", readonly=True)
    
    result, data = mail.search(None, "ALL")
    ids = data[0].split()
    
    os.makedirs(EXPORT_DIR, exist_ok=True)
    
    count = 0
    for i in ids[-limit:]: # Just last N for safety in testing
        res, msg_data = mail.fetch(i, "(RFC822)")
        raw_email = msg_data[0][1]
        msg = email.message_from_bytes(raw_email)

        subject = decode_mime_words(msg.get("Subject", "No Subject")).strip()
        sender = decode_mime_words(msg.get("From", "Unknown Sender")).strip()
        date = decode_mime_words(msg.get("Date", "Unknown Date")).strip()
        
        body = extract_body(msg)
        
        # Ensure filesystem-safe string
        safe_subject = re.sub(r'[\\/*?:"<>|]', "", subject)[:50]
        filename = f"email_{i.decode()}_{safe_subject.replace(' ','_')}.md"
        filepath = os.path.join(EXPORT_DIR, filename)

        # Markdown Frontmatter construction natively for the Vault Indexer
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("---\n")
            f.write(f"timestamp: {date}\n")
            f.write(f"sender: {sender}\n")
            f.write(f"subject: {subject}\n")
            f.write("type: email\n")
            f.write(f"source: IMAP_{user}\n")
            f.write("---\n\n")
            f.write(f"# Email: {subject}\n\n")
            f.write(f"**From:** {sender}\n")
            f.write(f"**Date:** {date}\n")
            f.write(f"**Source:** IMAP Sync\n\n")
            f.write("---\n\n")
            f.write(body.strip() if body else "No readable body extracted.")
        
        count += 1
        print(f" [+] Extracted & Formatted: {safe_subject}")

    mail.close()
    mail.logout()
    print(f"\n--- IMAP Vault Translation Complete. Formatted {count} Evidence Nodes. ---")

if __name__ == "__main__":
    print("Vault IMAP Discovery Pipeline")
    print("To execute extraction, invoke sync_emails_to_vault() with your credentials.")
