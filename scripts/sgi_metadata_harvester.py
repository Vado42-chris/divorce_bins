import os
import json
import sys
try:
    from PIL import Image
    from PIL.ExifTags import TAGS, GPSTAGS
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

def get_exif_data(image_path):
    """Extract EXIF data from an image file."""
    if not HAS_PIL:
        return {"error": "Pillow (PIL) library not found. Forensic EXIF extraction disabled."}
    try:
        img = Image.open(image_path)
        exif = img._getexif()
        if not exif:
            return None
        
        extracted = {}
        for tag, value in exif.items():
            decoded = TAGS.get(tag, tag)
            if decoded == "GPSInfo":
                gps_data = {}
                for t in value:
                    sub_decoded = GPSTAGS.get(t, t)
                    gps_data[sub_decoded] = value[t]
                extracted["GPS"] = gps_data
            else:
                extracted[decoded] = str(value)
        return extracted
    except Exception as e:
        return {"error": str(e)}

def format_gps(gps_info):
    """Format GPS coordinates into decimal degrees if possible."""
    if not gps_info:
        return None
    try:
        def to_decimal(values, ref):
            d = float(values[0])
            m = float(values[1])
            s = float(values[2])
            decimal = d + (m / 60.0) + (s / 3600.0)
            if ref in ['S', 'W']:
                decimal = -decimal
            return decimal

        lat = to_decimal(gps_info.get('GPSLatitude'), gps_info.get('GPSLatitudeRef'))
        lon = to_decimal(gps_info.get('GPSLongitude'), gps_info.get('GPSLongitudeRef'))
        return {"lat": lat, "lon": lon}
    except:
        return None

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 sgi_metadata_harvester.py <image_path>")
        sys.exit(1)

    image_path = sys.argv[1]
    if not os.path.exists(image_path):
        print(json.dumps({"error": f"File not found: {image_path}"}))
        sys.exit(1)

    exif = get_exif_data(image_path)
    if not exif:
        print(json.dumps({"error": "No EXIF data found"}))
        return

    timestamp = exif.get("DateTimeOriginal") or exif.get("DateTime")
    gps_raw = exif.get("GPS")
    gps_decimal = format_gps(gps_raw) if gps_raw else None

    # Specific forensic markers for SGI Arbitration
    verification = {
        "file": os.path.basename(image_path),
        "incident_timestamp": timestamp,
        "gps": gps_decimal,
        "is_saskatoon": False,
        "discrepancy_alert": False
    }

    # Cross-reference with known Saskatoon coordinates (approx)
    if gps_decimal:
        # Saskatoon approx: 52.13, -106.67
        # Level-A Forensic Matching: 0.1 deg (~10km)
        if abs(gps_decimal['lat'] - 52.13) < 0.1 and abs(gps_decimal['lon'] - (-106.67)) < 0.1:
            verification["is_saskatoon"] = True

    # Cross-reference with SGI Date of Loss: 2025-11-20
    if timestamp:
        if "2025:11:20" not in timestamp:
            verification["discrepancy_alert"] = True
            verification["discrepancy_reason"] = f"Image timestamp {timestamp} differs from SGI record 2025-11-20"

    print(f"FORENSIC_RESULT:{json.dumps(verification)}")

if __name__ == "__main__":
    main()
