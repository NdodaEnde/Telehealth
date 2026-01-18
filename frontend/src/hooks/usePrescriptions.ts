import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Prescription {
  id: string;
  appointment_id: string | null;
  clinical_note_id: string | null;
  clinician_id: string;
  patient_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number | null;
  refills: number;
  instructions: string | null;
  pharmacy_notes: string | null;
  status: string;
  prescribed_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  patient_name?: string;
  clinician_name?: string;
}

export interface CreatePrescriptionData {
  appointment_id?: string;
  clinical_note_id?: string;
  patient_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity?: number;
  refills?: number;
  instructions?: string;
  pharmacy_notes?: string;
  expires_at?: string;
}

export const usePrescriptions = () => {
  const { user, role } = useAuth();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrescriptions = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("prescriptions")
        .select("*")
        .order("prescribed_at", { ascending: false });

      if (fetchError) throw fetchError;

      // Fetch patient and clinician names
      const patientIds = [...new Set(data?.map(p => p.patient_id) || [])];
      const clinicianIds = [...new Set(data?.map(p => p.clinician_id) || [])];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", [...patientIds, ...clinicianIds]);

      const profileMap = new Map(
        profiles?.map(p => [p.id, `${p.first_name} ${p.last_name}`]) || []
      );

      const enrichedData = data?.map(p => ({
        ...p,
        patient_name: profileMap.get(p.patient_id) || "Unknown",
        clinician_name: profileMap.get(p.clinician_id) || "Unknown",
      })) || [];

      setPrescriptions(enrichedData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createPrescription = async (data: CreatePrescriptionData) => {
    if (!user) return { success: false, error: "Not authenticated" };

    try {
      const { data: prescription, error: createError } = await supabase
        .from("prescriptions")
        .insert({
          ...data,
          clinician_id: user.id,
        })
        .select()
        .single();

      if (createError) throw createError;

      await fetchPrescriptions();
      return { success: true, prescription };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const updatePrescriptionStatus = async (id: string, status: string) => {
    try {
      const { error: updateError } = await supabase
        .from("prescriptions")
        .update({ status })
        .eq("id", id);

      if (updateError) throw updateError;

      await fetchPrescriptions();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const getPrescriptionsForPatient = async (patientId: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from("prescriptions")
        .select("*")
        .eq("patient_id", patientId)
        .order("prescribed_at", { ascending: false });

      if (fetchError) throw fetchError;
      return { success: true, prescriptions: data };
    } catch (err: any) {
      return { success: false, error: err.message, prescriptions: [] };
    }
  };

  const getPrescriptionsForAppointment = async (appointmentId: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from("prescriptions")
        .select("*")
        .eq("appointment_id", appointmentId)
        .order("prescribed_at", { ascending: false });

      if (fetchError) throw fetchError;
      return { success: true, prescriptions: data };
    } catch (err: any) {
      return { success: false, error: err.message, prescriptions: [] };
    }
  };

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  return {
    prescriptions,
    loading,
    error,
    createPrescription,
    updatePrescriptionStatus,
    getPrescriptionsForPatient,
    getPrescriptionsForAppointment,
    refetch: fetchPrescriptions,
  };
};
