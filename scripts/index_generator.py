import os
import json
import re
import sys
from datetime import datetime
import hashlib

PROCESSED_DIR = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/evidence/processed"
METADATA_FILE = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/metadata/index.json"
GOVERNANCE_FILE = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/metadata/governance.json"
IDENTITIES_FILE = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/metadata/identities.json"

def load_governance():
    if os.path.exists(GOVERNANCE_FILE):
        with open(GOVERNANCE_FILE, 'r') as f:
            return json.load(f)
    return {"entities": [], "keywords": []}

def load_identities():
    if os.path.exists(IDENTITIES_FILE):
        with open(IDENTITIES_FILE, 'r') as f:
            return json.load(f)
    return []

def get_frontmatter(content):
    match = re.search(r'^---\s*(.*?)\s*---', content, re.DOTALL)
    if match:
        fm_text = match.group(1)
        data = {}
        for line in fm_text.split('\n'):
            if ':' in line:
                key, val = line.split(':', 1)
                data[key.strip()] = val.strip()
        return data
    return {}

def generate_index(target_dir=None, source_name=None):
    print(f"Generating Master Index for {target_dir or 'Vault'}...")
    gov = load_governance()
    identities = load_identities()
    keywords = [k['value'].lower() for k in gov.get('keywords', [])]
    entities = [e['value'].lower() for e in gov.get('entities', [])]
    
    if os.path.exists(METADATA_FILE):
        with open(METADATA_FILE, 'r') as f:
            index = json.load(f)
    else:
        index = []

    # Use a set for O(1) duplicate checking
    existing_paths = {item['path'] for item in index}
    
    scan_dir = target_dir if target_dir else PROCESSED_DIR
    new_items_count = 0
    total_files_scanned = 0
    
    for root, dirs, files in os.walk(scan_dir):
        for file in files:
            total_files_scanned += 1
            if total_files_scanned % 100 == 0:
                print(f"Scanned {total_files_scanned} files...")

            path = os.path.join(root, file)
            rel_path = os.path.relpath(path, PROCESSED_DIR if not target_dir else target_dir)
            
            # O(1) Lookup
            if rel_path in existing_paths:
                continue

            # Deterministic stable ID based on path
            path_hash = hashlib.sha1(rel_path.encode()).hexdigest()[:12]
            entry = {
                "id": f"{file}_{path_hash}", 
                "title": file,
                "timestamp": datetime.fromtimestamp(os.path.getmtime(path)).strftime('%Y-%m-%d %H:%M:%S'),
                "type": "generic",
                "source": source_name if source_name else "local",
                "status": "vault" if target_dir else "discovery",
                "path": rel_path
            }

            try:
                content = ""
                if file.endswith('.md'):
                    with open(path, 'r', errors='ignore') as f:
                        content = f.read()
                        fm = get_frontmatter(content)
                        entry.update({
                            "title": fm.get('subject', fm.get('sender', file)),
                            "timestamp": fm.get('timestamp', entry['timestamp']),
                            "type": fm.get('type', 'generic'),
                            "source": fm.get('source', entry['source']),
                            "status": fm.get('status', entry['status'])
                        })
                elif file.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
                    entry['type'] = 'media'
                    entry['title'] = f"Image: {file}"
                elif file.lower().endswith(('.mp4', '.mov')):
                    entry['type'] = 'media'
                    entry['title'] = f"Video: {file}"
                elif file.lower().endswith('.pdf'):
                    entry['type'] = 'document'
                    entry['title'] = f"Document: {file}"
                
                # Active Monitoring & Identity Resolution
                try:
                    cased_text = content if content else ""
                    if not cased_text and not entry['type'] == 'media':
                        with open(path, 'r', errors='ignore') as f:
                            cased_text = f.read()
                    
                    text = cased_text.lower()
                    
                    if cased_text:
                        # Heuristic Summary (first paragraph/sentence approx)
                        if 'summary' not in entry:
                            # Strip frontmatter if present
                            body = re.sub(r'^---\s*.*?\s*---', '', cased_text, flags=re.DOTALL).strip()
                            entry['summary'] = body[:150].replace('\n', ' ') + ('...' if len(body) > 150 else '')

                        # Governance matching
                        flagged_keywords = [k for k in keywords if k in text]
                        flagged_entities = [e for e in entities if e in text]
                        if flagged_keywords or flagged_entities:
                            entry['flagged'] = True
                            entry['flags'] = flagged_keywords + flagged_entities
                            
                            # Extract context snippets
                            snippets = []
                            for flag in entry['flags']:
                                idx = text.find(flag)
                                if idx != -1:
                                    start = max(0, idx - 45)
                                    end = min(len(text), idx + 45 + len(flag))
                                    snippets.append(f"...{cased_text[start:end].replace(chr(10), ' ')}...")
                            entry['flag_context'] = " | ".join(snippets)
                            print(f"  [ALERT] Flagged: {file} matches {entry['flags']}")
                        
                        # SGI & Medical Domain Tagging
                        sgi_medical_keywords = ['sgi', 'injury', 'claim', 'collision', 'physiotherapy', 'diagnosis', 'impairment', 'prescribed', 'rehabilitation', 'saskatchewan government insurance', 'medical', 'hospital']
                        domain_tags = [k for k in sgi_medical_keywords if k in text]
                        if domain_tags:
                            entry['domainTags'] = domain_tags
                            entry['domain'] = 'SGI/Medical'
                            try:
                                import sgi_parser
                                # Provide original cased content for Regex extraction
                                sgi_data = sgi_parser.parse_sgi_document(content if content else text)
                                entry['sgi_metadata'] = sgi_data
                            except Exception as parse_e:
                                print(f"SGI Parse Fault: {parse_e}")
                        # Financial & Bank Statement Tagging
                        financial_keywords = ['statement', 'transaction', 'withdrawal', 'deposit', 'balance', 'account', 'chequing', 'savings', 'credit card']
                        fin_tags = [k for k in financial_keywords if k in text]
                        if fin_tags:
                            entry['domainTags'] = list(set((entry.get('domainTags', []) + fin_tags)))
                            entry['domain'] = 'Financial'
                            try:
                                import financial_parser
                                fin_data = financial_parser.parse_financial_statement(cased_text)
                                entry['financial_metadata'] = fin_data
                                if fin_data['forensic_flags']:
                                    entry['flagged'] = True
                                    entry['flags'] = entry.get('flags', []) + ["FORENSIC_ALERT"]
                            except Exception as fin_e:
                                print(f"Financial Parse Fault: {fin_e}")
                        
                        # Witness Statement & Affidavit Tagging
                        witness_keywords = ['affidavit', 'oath', 'sworn', 'declarant', 'witness statement', 'statutory declaration']
                        wit_tags = [k for k in witness_keywords if k in text.lower()]
                        if wit_tags:
                            entry['domainTags'] = list(set((entry.get('domainTags', []) + wit_tags)))
                            entry['domain'] = 'Witness'
                            try:
                                import witness_parser
                                wit_data = witness_parser.parse_affidavit(text)
                                entry['witness_metadata'] = wit_data
                                if wit_data['declarant'] != 'Unknown':
                                    entry['participant'] = wit_data['declarant']
                            except Exception as wit_e:
                                print(f"Witness Parse Fault: {wit_e}")

                        if not fin_tags and not domain_tags and not wit_tags:
                            entry['domain'] = 'Family Law'

                        # Identity Resolution
                        for identity in identities:
                            for identifier in identity.get('identifiers', []):
                                if identifier.lower() in text:
                                    entry['identity'] = identity['name']
                                    entry['identityColor'] = identity.get('color', '#888')
                                    break

                except Exception as e:
                    print(f"Monitoring error: {e}")
                
                index.append(entry)
                existing_paths.add(rel_path)
                new_items_count += 1
            except Exception as e:
                print(f"Error processing {file}: {e}")
    
    if new_items_count > 0:
        # Sort by timestamp
        index.sort(key=lambda x: x['timestamp'], reverse=True)
        
        with open(METADATA_FILE, 'w') as f:
            json.dump(index, f, indent=2)
    
    print(f"Index updated. Total nodes: {len(index)} ({new_items_count} new)")

if __name__ == "__main__":
    t_dir = sys.argv[1] if len(sys.argv) > 1 else None
    s_name = sys.argv[2] if len(sys.argv) > 2 else None
    generate_index(t_dir, s_name)
