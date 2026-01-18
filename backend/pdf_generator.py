from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from io import BytesIO
import base64
from datetime import datetime
from models import PrescriptionPDFRequest

def generate_prescription_pdf(data: PrescriptionPDFRequest) -> str:
    """Generate a professional prescription PDF and return as base64 string"""
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )
    
    # Styles
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=6,
        textColor=colors.HexColor('#0d9488'),
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#64748b'),
        alignment=TA_CENTER,
        spaceAfter=20
    )
    
    section_header = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=colors.HexColor('#0d9488'),
        spaceBefore=15,
        spaceAfter=8,
        fontName='Helvetica-Bold'
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#1e293b')
    )
    
    label_style = ParagraphStyle(
        'Label',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#64748b')
    )
    
    medication_style = ParagraphStyle(
        'Medication',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor('#1e293b'),
        spaceBefore=10,
        spaceAfter=5,
        fontName='Helvetica-Bold'
    )
    
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#94a3b8'),
        alignment=TA_CENTER
    )
    
    # Build document content
    elements = []
    
    # Header
    elements.append(Paragraph("HCF Telehealth", title_style))
    elements.append(Paragraph("Electronic Prescription", subtitle_style))
    
    # Divider line
    elements.append(Spacer(1, 5))
    line_table = Table([['']],colWidths=[doc.width])
    line_table.setStyle(TableStyle([
        ('LINEABOVE', (0,0), (-1,0), 2, colors.HexColor('#0d9488')),
    ]))
    elements.append(line_table)
    elements.append(Spacer(1, 15))
    
    # Prescription Info Box
    rx_date = datetime.fromisoformat(data.prescribed_at.replace('Z', '+00:00')).strftime('%B %d, %Y') if data.prescribed_at else 'N/A'
    rx_number = data.prescription_id[:8].upper()
    
    info_data = [
        [Paragraph('<b>Rx Number:</b>', normal_style), Paragraph(rx_number, normal_style),
         Paragraph('<b>Date:</b>', normal_style), Paragraph(rx_date, normal_style)],
    ]
    
    info_table = Table(info_data, colWidths=[2.5*cm, 5*cm, 2*cm, 5*cm])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f0fdfa')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#0d9488')),
        ('PADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 20))
    
    # Patient Information
    elements.append(Paragraph("Patient Information", section_header))
    patient_data = [
        [Paragraph('<b>Name:</b>', label_style), Paragraph(data.patient_name, normal_style)],
    ]
    if data.patient_dob:
        patient_data.append([Paragraph('<b>Date of Birth:</b>', label_style), Paragraph(data.patient_dob, normal_style)])
    if data.patient_id_number:
        patient_data.append([Paragraph('<b>ID Number:</b>', label_style), Paragraph(data.patient_id_number, normal_style)])
    
    patient_table = Table(patient_data, colWidths=[4*cm, 10*cm])
    patient_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(patient_table)
    elements.append(Spacer(1, 15))
    
    # Prescriber Information
    elements.append(Paragraph("Prescriber Information", section_header))
    prescriber_data = [
        [Paragraph('<b>Name:</b>', label_style), Paragraph(f"Dr. {data.clinician_name}", normal_style)],
    ]
    if data.clinician_qualification:
        prescriber_data.append([Paragraph('<b>Qualification:</b>', label_style), Paragraph(data.clinician_qualification, normal_style)])
    if data.clinician_hpcsa:
        prescriber_data.append([Paragraph('<b>HPCSA No:</b>', label_style), Paragraph(data.clinician_hpcsa, normal_style)])
    prescriber_data.append([Paragraph('<b>Practice:</b>', label_style), Paragraph(data.clinic_name, normal_style)])
    
    prescriber_table = Table(prescriber_data, colWidths=[4*cm, 10*cm])
    prescriber_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('PADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(prescriber_table)
    elements.append(Spacer(1, 20))
    
    # Medication Box
    elements.append(Paragraph("Prescription Details", section_header))
    
    # Medication name with Rx symbol
    elements.append(Paragraph(f"℞  {data.medication_name}", medication_style))
    
    # Medication details in a styled box
    med_details = [
        [Paragraph('<b>Dosage:</b>', label_style), Paragraph(data.dosage, normal_style),
         Paragraph('<b>Frequency:</b>', label_style), Paragraph(data.frequency, normal_style)],
        [Paragraph('<b>Duration:</b>', label_style), Paragraph(data.duration, normal_style),
         Paragraph('<b>Quantity:</b>', label_style), Paragraph(str(data.quantity) if data.quantity else 'As directed', normal_style)],
        [Paragraph('<b>Refills:</b>', label_style), Paragraph(str(data.refills), normal_style),
         Paragraph('<b>Expires:</b>', label_style), Paragraph(data.expires_at[:10] if data.expires_at else 'N/A', normal_style)],
    ]
    
    med_table = Table(med_details, colWidths=[3*cm, 4.5*cm, 3*cm, 4.5*cm])
    med_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(med_table)
    elements.append(Spacer(1, 15))
    
    # Instructions
    if data.instructions:
        elements.append(Paragraph("Instructions for Patient", section_header))
        instruction_box = Table([[Paragraph(data.instructions, normal_style)]], colWidths=[doc.width])
        instruction_box.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fffbeb')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#fbbf24')),
            ('PADDING', (0, 0), (-1, -1), 12),
        ]))
        elements.append(instruction_box)
        elements.append(Spacer(1, 15))
    
    # Pharmacy Notes
    if data.pharmacy_notes:
        elements.append(Paragraph("Notes for Pharmacist", section_header))
        pharmacy_box = Table([[Paragraph(data.pharmacy_notes, normal_style)]], colWidths=[doc.width])
        pharmacy_box.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f0f9ff')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#0ea5e9')),
            ('PADDING', (0, 0), (-1, -1), 12),
        ]))
        elements.append(pharmacy_box)
    
    # Signature Area
    elements.append(Spacer(1, 30))
    sig_data = [
        ['', ''],
        [Paragraph('_' * 40, normal_style), Paragraph('_' * 20, normal_style)],
        [Paragraph(f"Dr. {data.clinician_name}", normal_style), Paragraph('Date', label_style)],
        [Paragraph('Electronic Signature', label_style), ''],
    ]
    sig_table = Table(sig_data, colWidths=[10*cm, 5*cm])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(sig_table)
    
    # Footer
    elements.append(Spacer(1, 30))
    footer_line = Table([['']],colWidths=[doc.width])
    footer_line.setStyle(TableStyle([
        ('LINEABOVE', (0,0), (-1,0), 0.5, colors.HexColor('#e2e8f0')),
    ]))
    elements.append(footer_line)
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(
        "This is an electronic prescription generated by HCF Telehealth.<br/>"
        "Valid for dispensing in accordance with SAPC regulations.<br/>"
        f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        footer_style
    ))
    
    # Build PDF
    doc.build(elements)
    
    # Get PDF bytes and encode to base64
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return base64.b64encode(pdf_bytes).decode('utf-8')
