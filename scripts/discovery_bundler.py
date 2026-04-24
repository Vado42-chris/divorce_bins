import json
import os
import zipfile
import shutil
from datetime import datetime
try:
    import img2pdf
    HAS_IMG2PDF = True
except ImportError:
    HAS_IMG2PDF = False

# Import stamper safely
try:
    from pdf_stamper import apply_bates_stamp
    HAS_STAMPER = True
except ImportError:
    HAS_STAMPER = False

METADATA_DIR = 'metadata'
ARGUMENTS_FILE = os.path.join(METADATA_DIR, 'arguments.json')
PROCESSED_DIR = 'evidence/processed'
OUTPUT_DIR = 'metadata/exports'
VAULT_INDEX = os.path.join(METADATA_DIR, 'index.json')

def create_discovery_bundle():
    print("Starting Hardened Discovery Bundle generation...")
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
    
    if not os.path.exists(ARGUMENTS_FILE):
        print("Error: Arguments file missing.")
        return None

    with open(ARGUMENTS_FILE, 'r') as f:
        arguments = json.load(f)
    
    vault = []
    if os.path.exists(VAULT_INDEX):
        with open(VAULT_INDEX, 'r') as f:
            vault = json.load(f)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    bundle_name = f"trial_discovery_{timestamp}.zip"
    bundle_path = os.path.join(OUTPUT_DIR, bundle_name)
    
    temp_stamp_dir = os.path.join(OUTPUT_DIR, f"temp_{timestamp}")
    os.makedirs(temp_stamp_dir)

    try:
        with zipfile.ZipFile(bundle_path, 'w') as zf:
            zf.writestr('Strategy/case_strategy_manifest.json', json.dumps(arguments, indent=2))
            
            toc_md = "# MASTER DISCOVERY INDEX (Table of Contents)\n"
            toc_md += f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
            toc_md += "| Bates ID | Document Title | Legal Relevance | Date |\n"
            toc_md += "| :--- | :--- | :--- | :--- |\n"
            
            # Generate Manifest for Chain of Custody
            manifest_json = {
                "bundle_id": bundle_name,
                "generated_at": datetime.now().isoformat(),
                "integrity_hash": "SHA-256",
                "files": []
            }

            bates_counter = 1
            added_files = set()

            for arg in arguments:
                for fact in arg.get('anchoredFacts', []):
                    source_id = fact.get('sourceId')
                    source_item = next((item for item in vault if item.get('id') == source_id), None)
                    
                    if source_item and source_item.get('path'):
                        orig_path = os.path.join(PROCESSED_DIR, source_item['path'])
                        if os.path.exists(orig_path) and orig_path not in added_files:
                            bates_num = f"DB-{bates_counter:04d}"
                            ext = os.path.splitext(orig_path)[1].lower()
                            dest_name_pdf = f"{bates_num}.pdf"
                            
                            current_work_file = orig_path
                            stamped_path = os.path.join(temp_stamp_dir, dest_name_pdf)

                            # Convert to PDF if needed
                            if ext in ['.png', '.jpg', '.jpeg'] and HAS_IMG2PDF:
                                pdf_temp = os.path.join(temp_stamp_dir, f"img_{bates_num}.pdf")
                                with open(pdf_temp, "wb") as f:
                                    f.write(img2pdf.convert(orig_path))
                                current_work_file = pdf_temp
                                ext = '.pdf'

                            if ext == '.pdf' and HAS_STAMPER:
                                next_bates = apply_bates_stamp(current_work_file, stamped_path, starting_number=bates_counter)
                                if next_bates:
                                    zf.write(stamped_path, arcname=os.path.join('Evidence', dest_name_pdf))
                                    bates_counter = next_bates
                                else:
                                    zf.write(orig_path, arcname=os.path.join('Evidence', f"{bates_num}{ext}"))
                                    bates_counter += 1
                            else:
                                zf.write(orig_path, arcname=os.path.join('Evidence', f"{bates_num}{ext}"))
                                bates_counter += 1

                            toc_md += f"| {bates_num} | {source_item['title']} | {arg['title']} | {source_item.get('timestamp', 'N/A')} |\n"
                            
                            # Add to Manifest
                            import hashlib
                            with open(orig_path, "rb") as f_hash:
                                file_hash = hashlib.sha256(f_hash.read()).hexdigest()
                            
                            manifest_json["files"].append({
                                "bates_id": bates_num,
                                "original_path": source_item['path'],
                                "sha256": file_hash,
                                "timestamp": source_item.get('timestamp')
                            })
                            
                            added_files.add(orig_path)
                
            zf.writestr('00_MASTER_INDEX.md', toc_md)
            zf.writestr('01_CHAIN_OF_CUSTODY.json', json.dumps(manifest_json, indent=2))

    finally:
        if os.path.exists(temp_stamp_dir):
            shutil.rmtree(temp_stamp_dir)

    # OIG Immutability Seal (Phase 50)
    if os.path.exists(bundle_path):
        import hashlib
        print(f"Applying Judicial Seal to {bundle_name}...")
        sha256_hash = hashlib.sha256()
        with open(bundle_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        
        master_hash = sha256_hash.hexdigest()
        lock_path = bundle_path + ".lock"
        lock_data = {
            "bundle_name": bundle_name,
            "master_sha256": master_hash,
            "sealed_at": datetime.now().isoformat(),
            "compliance_standard": "OIG-V7-MASTER-SEAL"
        }
        with open(lock_path, 'w') as f:
            json.dump(lock_data, f, indent=2)
        print(f"Judicial Seal Applied: {master_hash[:12]}...")

    return bundle_name

if __name__ == "__main__":
    name = create_discovery_bundle()
    if name:
        print(f"Bundle Created: {name}")
