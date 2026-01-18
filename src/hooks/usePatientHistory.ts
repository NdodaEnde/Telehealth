import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PatientHistoryAppointment {
  id: string;
  scheduled_at: string;
  consultation_type: string;
  status: string;
  duration_minutes: number;
  notes: string | null;
  clinician_name: string;
}

export interface PatientHistoryClinicalNote {
  id: string;
  appointment_id: string;
  chief_complaint: string | null;
  diagnosis: string[] | null;
  treatment_plan: string | null;
  signed_at: string | null;
  created_at: string;
  clinician_name: string;
}

export interface PatientHistoryPrescription {
  id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  status: string;
  prescribed_at: string;
  clinician_name: string;
}

export interface PatientHistory {
  appointments: PatientHistoryAppointment[];
  clinicalNotes: PatientHistoryClinicalNote[];
  prescriptions: PatientHistoryPrescription[];
}

export const usePatientHistory = (patientId: string | null) => {
  const [history, setHistory] = useState<PatientHistory>({
    appointments: [],
    clinicalNotes: [],
    prescriptions: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!patientId) return;

      setLoading(true);
      setError(null);

      try {
        // Fetch appointments
        const { data: appointmentsData, error: appointmentsError } = await supabase
          .from("appointments")
          .select("id, scheduled_at, consultation_type, status, duration_minutes, notes, clinician_id")
          .eq("patient_id", patientId)
          .order("scheduled_at", { ascending: false })
          .limit(50);

        if (appointmentsError) throw appointmentsError;

        // Fetch clinical notes
        const { data: notesData, error: notesError } = await supabase
          .from("clinical_notes")
          .select("id, appointment_id, chief_complaint, diagnosis, treatment_plan, signed_at, created_at, clinician_id")
          .eq("patient_id", patientId)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(50);

        if (notesError) throw notesError;

        // Fetch prescriptions
        const { data: prescriptionsData, error: prescriptionsError } = await supabase
          .from("prescriptions")
          .select("id, medication_name, dosage, frequency, duration, status, prescribed_at, clinician_id")
          .eq("patient_id", patientId)
          .order("prescribed_at", { ascending: false })
          .limit(50);

        if (prescriptionsError) throw prescriptionsError;

        // Get all clinician IDs
        const clinicianIds = [
          ...new Set([
            ...(appointmentsData?.map(a => a.clinician_id) || []),
            ...(notesData?.map(n => n.clinician_id) || []),
            ...(prescriptionsData?.map(p => p.clinician_id) || []),
          ]),
        ];

        // Fetch clinician profiles
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", clinicianIds);

        const profileMap = new Map(
          profiles?.map(p => [p.id, `Dr. ${p.first_name} ${p.last_name}`]) || []
        );

        // Enrich data with clinician names
        const appointments: PatientHistoryAppointment[] = appointmentsData?.map(a => ({
          id: a.id,
          scheduled_at: a.scheduled_at,
          consultation_type: a.consultation_type,
          status: a.status,
          duration_minutes: a.duration_minutes,
          notes: a.notes,
          clinician_name: profileMap.get(a.clinician_id) || "Unknown",
        })) || [];

        const clinicalNotes: PatientHistoryClinicalNote[] = notesData?.map(n => ({
          id: n.id,
          appointment_id: n.appointment_id,
          chief_complaint: n.chief_complaint,
          diagnosis: n.diagnosis,
          treatment_plan: n.treatment_plan,
          signed_at: n.signed_at,
          created_at: n.created_at,
          clinician_name: profileMap.get(n.clinician_id) || "Unknown",
        })) || [];

        const prescriptions: PatientHistoryPrescription[] = prescriptionsData?.map(p => ({
          id: p.id,
          medication_name: p.medication_name,
          dosage: p.dosage,
          frequency: p.frequency,
          duration: p.duration,
          status: p.status,
          prescribed_at: p.prescribed_at,
          clinician_name: profileMap.get(p.clinician_id) || "Unknown",
        })) || [];

        setHistory({ appointments, clinicalNotes, prescriptions });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [patientId]);

  return { history, loading, error };
};
