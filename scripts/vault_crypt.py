import json
import os
from cryptography.fernet import Fernet

IDENTITY_PATH = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/metadata/identities.json"
VAULT_PATH = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins/evidence/processed/vault.json"

def get_secret_key():
    """Retrieves or generates the master encryption key."""
    if os.path.exists(IDENTITY_PATH):
        with open(IDENTITY_PATH, "r") as f:
            ids = json.load(f)
            if "vault_key" in ids:
                return ids["vault_key"].encode()
    
    # Generate new key if missing
    key = Fernet.generate_key()
    if os.path.exists(IDENTITY_PATH):
        with open(IDENTITY_PATH, "r+ ") as f:
            ids = json.load(f)
            ids["vault_key"] = key.decode()
            f.seek(0)
            json.dump(ids, f, indent=2)
            f.truncate()
    return key

def encrypt_vault():
    """Encrypts the vault.json file."""
    if not os.path.exists(VAULT_PATH):
        return False
    
    key = get_secret_key()
    fernet = Fernet(key)
    
    with open(VAULT_PATH, "rb") as f:
        data = f.read()
    
    encrypted = fernet.encrypt(data)
    
    with open(VAULT_PATH + ".enc", "wb") as f:
        f.write(encrypted)
    
    return True

def decrypt_vault():
    """Decrypts the vault.json file for API access."""
    enc_path = VAULT_PATH + ".enc"
    if not os.path.exists(enc_path):
        return False
    
    key = get_secret_key()
    fernet = Fernet(key)
    
    with open(enc_path, "rb") as f:
        encrypted = f.read()
    
    decrypted = fernet.decrypt(encrypted)
    
    with open(VAULT_PATH, "wb") as f:
        f.write(decrypted)
        
    return True

if __name__ == "__main__":
    import sys
    action = sys.argv[1] if len(sys.argv) > 1 else "encrypt"
    if action == "encrypt":
        if encrypt_vault():
            print("Vault Encrypted [v3.3.0 Security Lock]")
    elif action == "decrypt":
        if decrypt_vault():
            print("Vault Decrypted [Auth Signal]")
