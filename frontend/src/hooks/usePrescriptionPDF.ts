import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || '';

export interface PrescriptionPDFData {
  prescription_id: string;
  patient_name: string;
  patient_dob?: string;
  patient_id_number?: string;
  clinician_name: string;
  clinician_qualification?: string;
  clinician_hpcsa?: string;
  clinic_name?: string;
  clinic_address?: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity?: number;
  refills?: number;
  instructions?: string;
  pharmacy_notes?: string;
  prescribed_at: string;
  expires_at?: string;
}

export const usePrescriptionPDF = () => {
  const [loading, setLoading] = useState(false);

  const getAuthToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  const generatePDF = async (data: PrescriptionPDFData): Promise<string | null> => {
    setLoading(true);

    try {
      const token = await getAuthToken();
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${BACKEND_URL}/api/prescriptions/generate-pdf`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('PDF generation failed:', response.status, errorText);
        throw new Error(`Failed to generate PDF: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.pdf_base64) {
        return result.pdf_base64;
      } else {
        throw new Error(result.error || 'Failed to generate PDF');
      }
    } catch (err: any) {
      console.error('PDF generation error:', err);
      toast.error('Failed to generate prescription PDF');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async (data: PrescriptionPDFData, filename?: string) => {
    const base64 = await generatePDF(data);
    
    if (base64) {
      // Convert base64 to blob
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `prescription_${data.prescription_id.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Prescription PDF downloaded');
      return true;
    }

    return false;
  };

  const openPDFInNewTab = async (data: PrescriptionPDFData) => {
    const base64 = await generatePDF(data);
    
    if (base64) {
      // Open in new tab
      const pdfWindow = window.open('');
      if (pdfWindow) {
        pdfWindow.document.write(
          `<iframe width='100%' height='100%' src='data:application/pdf;base64,${base64}'></iframe>`
        );
        pdfWindow.document.title = `Prescription - ${data.medication_name}`;
      }
      return true;
    }

    return false;
  };

  return {
    loading,
    generatePDF,
    downloadPDF,
    openPDFInNewTab
  };
};
