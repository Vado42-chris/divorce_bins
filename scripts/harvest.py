import os
import subprocess
import shutil

# CONFIGURATION
BACKUP_DIR = "/media/chrishallberg/Storage 11/Backups/phone/pixel"
PHONE_DCIM = "/sdcard/DCIM"
PHONE_PICTURES = "/sdcard/Pictures"

def run_adb(command):
    try:
        result = subprocess.run(["adb"] + command, capture_output=True, text=True)
        return result.stdout.strip()
    except Exception as e:
        return f"Error: {e}"

def safe_harvest():
    print(f"--- Starting Safe Harvest to {BACKUP_DIR} ---")
    
    # Check if adb is installed
    if shutil.which("adb") is None:
        print("Error: adb is not installed. Please run 'sudo apt install adb'")
        return

    # Check devices
    devices = run_adb(["devices"])
    if "device" not in devices.split("\n")[1:]:
        print("Error: No device connected. Ensure USB Debugging is ON.")
        return

    # Pulling DCIM
    print(f"Copying DCIM from phone (Non-destructive)...")
    target_dcim = os.path.join(BACKUP_DIR, "DCIM")
    os.makedirs(target_dcim, exist_ok=True)
    subprocess.run(["adb", "pull", PHONE_DCIM, BACKUP_DIR])

    # Pulling Pictures
    print(f"Copying Pictures from phone (Non-destructive)...")
    target_pics = os.path.join(BACKUP_DIR, "Pictures")
    os.makedirs(target_pics, exist_ok=True)
    subprocess.run(["adb", "pull", PHONE_PICTURES, BACKUP_DIR])

    print("\n--- Harvest Complete. Running Intelligence Pipelines ---")
    
    # Trigger Re-indexing and Strategic Audit
    try:
        print("Regenerating Vault Index...")
        subprocess.run(["python3", "scripts/index_generator.py"], check=True)
        print("Running Strategic Cross-Check...")
        subprocess.run(["python3", "scripts/domain_cross_checker.py"], check=True)
        print("Intelligence Pipeline: SUCCESS")
    except Exception as e:
        print(f"Intelligence Pipeline: FAILED ({e})")

    print("\n--- Process Complete. Vault is up to date. ---")

if __name__ == "__main__":
    safe_harvest()
