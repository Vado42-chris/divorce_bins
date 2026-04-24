import re
import json
import os
from datetime import datetime

# Form 13.1 Part 1: ASSETS
# Form 13.1 Part 2: DEBTS/LIABILITIES

def parse_financial_statement(text):
    """
    Industrial-grade parser for OCR'd statements.
    Aligns heuristic extraction with Form 13.1 Legal Standards.
    """
    data = {
        "metadata": {
            "institution": "Unknown",
            "account_type": "Unknown",
            "statement_period": "Unknown",
            "generated_at": datetime.now().toISOString() if hasattr(datetime.now(), 'toISOString') else datetime.now().strftime("%Y-%m-%dT%H:M:%S")
        },
        "summary": {
            "total_credits": 0.0,
            "total_debits": 0.0,
            "net_flow": 0.0
        },
        "form_13_1_mapping": {
            "PART_1_ASSETS": [],
            "PART_2_DEBTS": []
        },
        "forensic_flags": []
    }

    # 1. Institution High-Confidence Detection
    institutions = {
        r'RBC|Royal Bank': "RBC",
        r'TD|Canada Trust': "TD",
        r'Conexus': "Conexus",
        r'Scotiabank': "Scotiabank",
        r'BMO|Bank of Montreal': "BMO",
        r'CIBC': "CIBC"
    }
    for pattern, name in institutions.items():
        if re.search(pattern, text, re.I):
            data["metadata"]["institution"] = name
            break

    # 2. Form 13.1 Categorization Map
    # Part 1: Assets (Savings, RRSPs, etc.)
    # Part 2: Debts (Visa, Mastercard, Loans)
    categories = {
        "PART_2_DEBTS": {
            "lines": ["VISA", "MASTERCARD", "AMEX", "CREDIT", "LOAN", "MORTGAGE", "INTEREST", "PYMT"],
            "13.1_Section": "Debts and Liabilities"
        },
        "PART_1_ASSETS": {
            "lines": ["SAVINGS", "INVESTMENT", "RRSP", "TFSA", "DIVIDENDS", "DEPOSIT"],
            "13.1_Section": "Financial Assets"
        }
    }

    # 3. Transaction Forensic Extraction
    lines = text.split('\n')
    for line in lines:
        # Match standard transaction patterns: DATE DESC AMOUNT
        # Example: 2025-10-01 AMAZON MARKETPLACE 45.99
        match = re.search(r'(\d{4}-\d{2}-\d{2})?\s*([A-Z\s\d*.-]{5,})\s*(\d{1,6}\.\d{2})', line, re.I)
        if match:
            date_str = match.group(1) or datetime.now().strftime("%Y-%m-%d")
            desc = match.group(2).strip().upper()
            amount = float(match.group(3).replace(',', ''))
            
            # Categorize based on Form 13.1 Logic
            target_part = "PART_2_DEBTS" # Default to Outflow/Debt for safety
            for part, cfg in categories.items():
                if any(k in desc for k in cfg["lines"]):
                    target_part = part
                    break

            entry = {
                "date": date_str,
                "description": desc,
                "amount": amount,
                "evidence_anchor": "INFERRED_FROM_TEXT",
                "form_section": categories[target_part]["13.1_Section"]
            }

            data["form_13_1_mapping"][target_part].append(entry)
            
            # Aggregation
            if target_part == "PART_2_DEBTS":
                data["summary"]["total_debits"] += amount
            else:
                data["summary"]["total_credits"] += amount

            # Forensic Flagging
            if amount >= 2000:
                data["forensic_flags"].append({
                    "type": "THRESHOLD_ALERT",
                    "message": f"Large transaction detected: {amount} in {desc}",
                    "severity": "CRITICAL"
                })

    data["summary"]["net_flow"] = data["summary"]["total_credits"] - data["summary"]["total_debits"]
    return data

if __name__ == "__main__":
    sample = """
    RBC ROYAL BANK STATEMENT
    2025-11-01 VISA PAYMENT -500.00
    2025-11-02 CONEXUS MORTGAGE -2400.00
    2025-11-03 PAYROLL DEPOSIT +4500.00
    2025-11-04 TFSA CONTRIBUTION 1000.00
    """
    print(json.dumps(parse_financial_statement(sample), indent=2))
