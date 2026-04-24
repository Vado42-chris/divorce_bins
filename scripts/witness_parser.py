import re
import json

def parse_affidavit(text):
    """
    Parses formal affidavits and witness statements.
    Look for 'I, [NAME], of [CITY], ... MAKE OATH AND SAY:'
    """
    data = {
        "declarant": "Unknown",
        "sworn_date": "Unknown",
        "paragraphs": [],
        "type": "Statement"
    }

    # 1. Declarant Detection
    declarant_match = re.search(r'I,\s+([A-Z\s,]+)\s*(?:of|in|currently)', text, re.I)
    if declarant_match:
        data["declarant"] = declarant_match.group(1).strip()
    
    if re.search(r'Affidavit|Oath|Sworn', text, re.I):
        data["type"] = "Affidavit"

    # 2. Paragraph Extraction
    # Numbered paragraphs like "1. I am the mother..." or "2. That at approximately..."
    lines = text.split('\n')
    current_para = ""
    for line in lines:
        para_match = re.search(r'^(\d+)\.\s+(.*)', line.strip())
        if para_match:
            if current_para: data["paragraphs"].append(current_para)
            current_para = para_match.group(2)
        elif current_para and line.strip():
            current_para += " " + line.strip()
    
    if current_para:
        data["paragraphs"].append(current_para)

    return data

if __name__ == "__main__":
    sample = "I, JANE DOE, of Regina, Saskatchewan, MAKE OATH AND SAY:\n1. I have personal knowledge of the facts.\n2. On Dec 1st, I saw the defendant at the park."
    print(json.dumps(parse_affidavit(sample), indent=2))
