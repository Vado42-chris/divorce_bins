import os
import shutil
import tarfile
from datetime import datetime, timedelta

BASE_DIR = "/media/chrishallberg/Storage 22/002_Personal/divorce_bins"
BACKUP_DIR = os.path.join(BASE_DIR, "metadata/backups")

def perform_backup():
    """Creates a timestamped backup of evidence and metadata."""
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(BACKUP_DIR, f"divorce_bins_backup_{timestamp}.tar.gz")

    with tarfile.open(backup_path, "w:gz") as tar:
        for folder in ["evidence", "metadata"]:
            target = os.path.join(BASE_DIR, folder)
            if os.path.exists(target):
                tar.add(target, arcname=folder)
    
    # Cleanup old backups (Keep 7 days)
    threshold = datetime.now() - timedelta(days=7)
    for f in os.listdir(BACKUP_DIR):
        fpath = os.path.join(BACKUP_DIR, f)
        if os.path.getmtime(fpath) < threshold.timestamp():
            os.remove(fpath)
            
    return backup_path

if __name__ == "__main__":
    path = perform_backup()
    print(f"Operational Snapshot Created: {path}")
