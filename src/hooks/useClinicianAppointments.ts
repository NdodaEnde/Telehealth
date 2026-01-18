import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { startOfDay, endOfDay, addDays, format } from "date-fns";

export interface ClinicianAppointment {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string | null;
  scheduled_at: string;
  duration_minutes: number;
  consultation_type: "video" | "phone" | "in_person";
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
  symptoms: string[];
  severity: "mild" | "moderate" | "severe";
  symptom_description: string | null;
  notes: string | null;
  created_at: string;
}

type AppointmentStatus = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";

interface UseClinicianAppointmentsOptions {
  startDate?: Date;
  endDate?: Date;
  status?: AppointmentStatus[];
}

export const useClinicianAppointments = (options?: UseClinicianAppointmentsOptions) => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<ClinicianAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("appointments")
        .select(`
          *,
          symptom_assessments (
            symptoms,
            severity,
            description
          )
        `)
        .eq("clinician_id", user.id)
        .order("scheduled_at", { ascending: true });

      // Apply date filters
      if (options?.startDate) {
        query = query.gte("scheduled_at", startOfDay(options.startDate).toISOString());
      }
      if (options?.endDate) {
        query = query.lte("scheduled_at", endOfDay(options.endDate).toISOString());
      }

      // Apply status filter
      if (options?.status && options.status.length > 0) {
        query = query.in("status", options.status);
      }

      const { data: appointmentsData, error: appointmentsError } = await query;

      if (appointmentsError) throw appointmentsError;

      // Fetch patient profiles
      const patientIds = [...new Set(appointmentsData?.map((a) => a.patient_id) || [])];
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, phone")
        .in("id", patientIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      const enrichedAppointments: ClinicianAppointment[] = (appointmentsData || []).map((apt) => {
        const profile = profileMap.get(apt.patient_id);
        const assessment = apt.symptom_assessments;

        return {
          id: apt.id,
          patient_id: apt.patient_id,
          patient_name: profile
            ? `${profile.first_name} ${profile.last_name}`
            : "Unknown Patient",
          patient_phone: profile?.phone || null,
          scheduled_at: apt.scheduled_at,
          duration_minutes: apt.duration_minutes,
          consultation_type: apt.consultation_type,
          status: apt.status,
          symptoms: assessment?.symptoms || [],
          severity: assessment?.severity || "mild",
          symptom_description: assessment?.description || null,
          notes: apt.notes,
          created_at: apt.created_at,
        };
      });

      setAppointments(enrichedAppointments);
    } catch (err: any) {
      console.error("Error fetching appointments:", err);
      setError(err.message);
      toast.error("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, [user, options?.startDate, options?.endDate, options?.status]);

  const updateAppointmentStatus = useCallback(
    async (appointmentId: string, status: ClinicianAppointment["status"]) => {
      try {
        const { error } = await supabase
          .from("appointments")
          .update({ status })
          .eq("id", appointmentId);

        if (error) throw error;

        setAppointments((prev) =>
          prev.map((apt) =>
            apt.id === appointmentId ? { ...apt, status } : apt
          )
        );

        toast.success(`Appointment ${status}`);
        return true;
      } catch (err: any) {
        console.error("Error updating appointment:", err);
        toast.error("Failed to update appointment");
        return false;
      }
    },
    []
  );

  const updateAppointmentNotes = useCallback(
    async (appointmentId: string, notes: string) => {
      try {
        const { error } = await supabase
          .from("appointments")
          .update({ notes })
          .eq("id", appointmentId);

        if (error) throw error;

        setAppointments((prev) =>
          prev.map((apt) =>
            apt.id === appointmentId ? { ...apt, notes } : apt
          )
        );

        toast.success("Notes saved");
        return true;
      } catch (err: any) {
        console.error("Error updating notes:", err);
        toast.error("Failed to save notes");
        return false;
      }
    },
    []
  );

  const rescheduleAppointment = useCallback(
    async (appointmentId: string, newDateTime: Date) => {
      try {
        const { error } = await supabase
          .from("appointments")
          .update({ 
            scheduled_at: newDateTime.toISOString(),
            status: "pending" 
          })
          .eq("id", appointmentId);

        if (error) throw error;

        setAppointments((prev) =>
          prev.map((apt) =>
            apt.id === appointmentId
              ? { ...apt, scheduled_at: newDateTime.toISOString(), status: "pending" as const }
              : apt
          )
        );

        toast.success("Appointment rescheduled");
        return true;
      } catch (err: any) {
        console.error("Error rescheduling:", err);
        toast.error("Failed to reschedule appointment");
        return false;
      }
    },
    []
  );

  // Set up realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("clinician-appointments")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `clinician_id=eq.${user.id}`,
        },
        () => {
          fetchAppointments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchAppointments]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  return {
    appointments,
    loading,
    error,
    refetch: fetchAppointments,
    updateAppointmentStatus,
    updateAppointmentNotes,
    rescheduleAppointment,
  };
};
