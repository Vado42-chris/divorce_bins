import json
import os
import hashlib
import sys

def verify_judicial_bundle(bundle_path):
    """
    Verifies the integrity of a discovery bundle against its judicial .lock file.
    Returns (Success, Message)
    """
    lock_path = bundle_path + ".lock"
    
    if not os.path.exists(bundle_path):
        return False, f"Error: Bundle not found at {bundle_path}"
    
    if not os.path.exists(lock_path):
        return False, "Error: Judicial seal (.lock) missing. Bundle is NOT verified."

    print(f"Analyzing OIG Seal for {os.path.basename(bundle_path)}...")
    
    with open(lock_path, 'r') as f:
        lock_data = json.load(f)
    
    expected_hash = lock_data.get('master_sha256')
    
    sha256_hash = hashlib.sha256()
    with open(bundle_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    
    actual_hash = sha256_hash.hexdigest()
    
    if actual_hash == expected_hash:
        return True, f"VERIFIED: Bundle integrity matches OIG Seal ({actual_hash[:12]})."
    else:
        return False, f"TAMPER ALERT: Bundle hash ({actual_hash[:12]}) DOES NOT MATCH seal ({expected_hash[:12]}). EVIDENCE COMPROMISED."

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 judicial_verifier.py <path_to_bundle.zip>")
        sys.exit(1)
        
    success, message = verify_judicial_bundle(sys.argv[1])
    print(message)
    if not success:
        sys.exit(1)
