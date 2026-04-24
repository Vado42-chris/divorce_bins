import os
import hashlib
import json
import sys

VAULT_DIR = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/evidence/processed"
MANIFEST_PATH = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/metadata/manifest.sha256"

def get_file_hash(filepath):
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as f:
        buf = f.read(65536)
        while len(buf) > 0:
            hasher.update(buf)
            buf = f.read(65536)
    return hasher.hexdigest()

def scan_vault():
    print(f"[SHIELD] Starting Integrity Scan: {VAULT_DIR}")
    current_hashes = {}
    
    # Ensure processed directory exists
    if not os.path.exists(VAULT_DIR):
        os.makedirs(VAULT_DIR, exist_ok=True)
        print(f"[SHIELD] Empty Vault Initialized at {VAULT_DIR}")

    for root, dirs, files in os.walk(VAULT_DIR):
        for file in files:
            full_path = os.path.join(root, file)
            # Filter out the manifest itself if somehow nested
            if file == "manifest.sha256":
                continue
            rel_path = os.path.relpath(full_path, VAULT_DIR)
            current_hashes[rel_path] = get_file_hash(full_path)

    if not os.path.exists(MANIFEST_PATH):
        print(f"[SHIELD] No manifest found. Generating initial manifest...")
        with open(MANIFEST_PATH, 'w') as f:
            json.dump(current_hashes, f, indent=2)
        print("[SHIELD] Manifest Generated: SUCCESS")
        return True

    # If manifest exists but command failed, it might be corrupted or 'init' string from Shell
    try:
        with open(MANIFEST_PATH, 'r') as f:
            content = f.read().strip()
            if not content or content == "init": # Handle the shell-seeded initial case
                 print(f"[SHIELD] Reseeding empty/init manifest...")
                 with open(MANIFEST_PATH, 'w') as f_out:
                     json.dump(current_hashes, f_out, indent=2)
                 return True
            manifest = json.loads(content)
    except Exception as e:
        print(f"[SHIELD] Manifest corruption detected: {e}")
        return False

    violations = []
    for path, h in current_hashes.items():
        if path not in manifest:
            violations.append(f"NEW_FILE_DETECTED: {path}")
        elif manifest[path] != h:
            violations.append(f"INTEGRITY_VIOLATION: {path} (Hash Mismatch)")

    for path in manifest:
        if path not in current_hashes:
            # Check if it was an empty manifest init
            if path:
                violations.append(f"FILE_MISSING: {path}")

    if violations:
        print("[CRITICAL] INTEGRITY SCAN FAILED")
        for v in violations:
            print(f" [!] {v}")
        return False

    print("[SHIELD] Integrity Verified: 100%")
    return True

def seal_vault():
    print(f"[SHIELD] Sealing Vault: {VAULT_DIR}")
    current_hashes = {}
    for root, dirs, files in os.walk(VAULT_DIR):
        for file in files:
            full_path = os.path.join(root, file)
            if file == "manifest.sha256":
                continue
            rel_path = os.path.relpath(full_path, VAULT_DIR)
            current_hashes[rel_path] = get_file_hash(full_path)
    
    with open(MANIFEST_PATH, 'w') as f:
        json.dump(current_hashes, f, indent=2)
    print("[SHIELD] Vault Sealed Successfully.")
    return True

if __name__ == "__main__":
    if "--seal" in sys.argv:
        success = seal_vault()
    else:
        success = scan_vault()
    sys.exit(0 if success else 1)
