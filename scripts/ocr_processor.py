import os
import sys
import json
import logging

try:
    import pytesseract
    from pdf2image import convert_from_path
    from PIL import Image
except ImportError:
    logging.error("Required libraries (pytesseract, pdf2image, PIL) not found. Cannot perform OCR.")
    print("[]")
    sys.exit(1)

def extract_text(file_path):
    try:
        if file_path.lower().endswith('.pdf'):
            images = convert_from_path(file_path)
            text = ""
            for index, image in enumerate(images):
                text += pytesseract.image_to_string(image) + "\n"
            return text
        elif file_path.lower().endswith(('.png', '.jpg', '.jpeg')):
            return pytesseract.image_to_string(Image.open(file_path))
    except Exception as e:
        logging.error(f"Failed to process {file_path}: {e}")
    return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ocr_processor.py <file_or_dir>")
        sys.exit(1)
        
    target = sys.argv[1]
    
    # We will output structured JSON so the backend can ingest the extracted visual nodes
    if os.path.isfile(target):
        print(json.dumps([{"path": target, "text": extract_text(target)}]))
    elif os.path.isdir(target):
        results = []
        for root, dirs, files in os.walk(target):
            for file in files:
                if file.lower().endswith(('.pdf', '.png', '.jpg', '.jpeg')):
                    full_path = os.path.join(root, file)
                    text = extract_text(full_path)
                    if text and text.strip():
                        results.append({"path": full_path, "text": text.strip()})
        print(json.dumps(results))
    else:
        print("[]")
