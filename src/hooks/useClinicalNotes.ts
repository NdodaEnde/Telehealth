import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface ICD10Code {
  code: string;
  description: string;
}

export interface ClinicalNote {
  id: string;
  appointment_id: string;
  clinician_id: string;
  patient_id: string;
  chief_complaint: string | null;
  history_of_present_illness: string | null;
  examination_findings: string | null;
  diagnosis: string[] | null;
  icd10_codes: ICD10Code[];
  treatment_plan: string | null;
  follow_up_instructions: string | null;
  follow_up_date: string | null;
  referral_required: boolean;
  referral_details: string | null;
  status: "draft" | "completed" | "signed";
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useClinicalNotes = () => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("clinical_notes")
        .select("*")
        .eq("clinician_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setNotes(
        (data || []).map((note) => ({
          ...note,
          icd10_codes: (note.icd10_codes as unknown as ICD10Code[]) || [],
          status: note.status as "draft" | "completed" | "signed",
        }))
      );
    } catch (err: any) {
      console.error("Error fetching clinical notes:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const getNoteForAppointment = useCallback(
    async (appointmentId: string): Promise<ClinicalNote | null> => {
      if (!user) return null;

      try {
        const { data, error } = await supabase
          .from("clinical_notes")
          .select("*")
          .eq("appointment_id", appointmentId)
          .eq("clinician_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (!data) return null;

        return {
          ...data,
          icd10_codes: (data.icd10_codes as unknown as ICD10Code[]) || [],
          status: data.status as "draft" | "completed" | "signed",
        };
      } catch (err: any) {
        console.error("Error fetching note for appointment:", err);
        return null;
      }
    },
    [user]
  );

  const getPendingNotesCount = useCallback(async (): Promise<number> => {
    if (!user) return 0;

    try {
      const { count, error } = await supabase
        .from("clinical_notes")
        .select("*", { count: "exact", head: true })
        .eq("clinician_id", user.id)
        .eq("status", "draft");

      if (error) throw error;

      return count || 0;
    } catch (err: any) {
      console.error("Error fetching pending notes count:", err);
      return 0;
    }
  }, [user]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  return {
    notes,
    loading,
    error,
    refetch: fetchNotes,
    getNoteForAppointment,
    getPendingNotesCount,
  };
};
