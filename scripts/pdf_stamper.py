import os
import io
from pypdf import PdfWriter, PdfReader
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

def apply_bates_stamp(input_pdf_path, output_pdf_path, bates_prefix="DB", starting_number=1):
    """
    Applies a Bates stamp to the bottom-right of every page in a PDF.
    """
    if not os.path.exists(input_pdf_path):
        print(f"Error: Input PDF not found: {input_pdf_path}")
        return False

    reader = PdfReader(input_pdf_path)
    writer = PdfWriter()
    
    current_bates = starting_number
    
    for i in range(len(reader.pages)):
        page = reader.pages[i]
        
        # Create overlay
        packet = io.BytesIO()
        can = canvas.Canvas(packet, pagesize=(page.mediabox.width, page.mediabox.height))
        
        # Style the Bates Stamp
        bates_text = f"{bates_prefix}-{current_bates:04d}"
        can.setFont("Helvetica-Bold", 10)
        can.setFillColorRGB(0.5, 0.5, 0.5, alpha=0.7) # Translucent gray
        
        # Position: Bottom Right (approx 40 units from edge)
        margin = 40
        can.drawRightString(float(page.mediabox.width) - margin, margin, bates_text)
        can.save()
        
        # Merge overlay onto page
        packet.seek(0)
        new_pdf = PdfReader(packet)
        page.merge_page(new_pdf.pages[0])
        
        writer.add_page(page)
        current_bates += 1

    with open(output_pdf_path, "wb") as output_file:
        # Embed Bates Metadata for Judicial Searchability (Phase 50)
        writer.add_metadata({
            "/Producer": f"Divorce Bins Forensic Vault (Bates: {bates_prefix}-{starting_number:04d} to {bates_prefix}-{current_bates-1:04d})",
            "/Title": f"Judicial Export: {bates_prefix}-{starting_number:04d}"
        })
        writer.write(output_file)
    
    return current_bates

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 2:
        res = apply_bates_stamp(sys.argv[1], sys.argv[2])
        if res:
             print(f"Stamp Complete. Next Bates: {res}")
    else:
        print("Usage: python3 pdf_stamper.py <input.pdf> <output.pdf>")
