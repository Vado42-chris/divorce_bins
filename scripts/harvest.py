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

    print("\n--- Harvest Complete. No data was deleted from the phone. ---")

if __name__ == "__main__":
    safe_harvest()
