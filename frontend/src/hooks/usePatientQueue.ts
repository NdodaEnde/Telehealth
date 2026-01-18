import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfDay, endOfDay } from "date-fns";

export interface QueuePatient {
  id: string;
  patient_id: string;
  patient_name: string;
  scheduled_at: string;
  consultation_type: "video" | "phone" | "in_person";
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
  symptoms: string[];
  severity: "mild" | "moderate" | "severe";
  symptom_description: string | null;
  created_at: string;
}

export interface QueueStats {
  waiting: number;
  inProgress: number;
  completed: number;
  total: number;
}

export const usePatientQueue = () => {
  const { user } = useAuth();
  const [queue, setQueue] = useState<QueuePatient[]>([]);
  const [stats, setStats] = useState<QueueStats>({ waiting: 0, inProgress: 0, completed: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    if (!user) return;

    try {
      const today = new Date();
      const dayStart = startOfDay(today).toISOString();
      const dayEnd = endOfDay(today).toISOString();

      // Fetch today's appointments for this clinician
      const { data: appointments, error: appointmentsError } = await supabase
        .from("appointments")
        .select(`
          id,
          patient_id,
          scheduled_at,
          consultation_type,
          status,
          created_at,
          symptom_assessment_id
        `)
        .eq("clinician_id", user.id)
        .gte("scheduled_at", dayStart)
        .lte("scheduled_at", dayEnd)
        .order("scheduled_at", { ascending: true });

      if (appointmentsError) throw appointmentsError;

      if (!appointments || appointments.length === 0) {
        setQueue([]);
        setStats({ waiting: 0, inProgress: 0, completed: 0, total: 0 });
        return;
      }

      // Get patient profiles
      const patientIds = [...new Set(appointments.map(a => a.patient_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", patientIds);

      if (profilesError) throw profilesError;

      // Get symptom assessments
      const assessmentIds = appointments
        .map(a => a.symptom_assessment_id)
        .filter(Boolean) as string[];

      let assessments: any[] = [];
      if (assessmentIds.length > 0) {
        const { data: assessmentData, error: assessmentError } = await supabase
          .from("symptom_assessments")
          .select("id, symptoms, severity, description")
          .in("id", assessmentIds);

        if (assessmentError) throw assessmentError;
        assessments = assessmentData || [];
      }

      // Merge data
      const mergedQueue: QueuePatient[] = appointments.map(apt => {
        const profile = profiles?.find(p => p.id === apt.patient_id);
        const assessment = assessments.find(a => a.id === apt.symptom_assessment_id);

        return {
          id: apt.id,
          patient_id: apt.patient_id,
          patient_name: profile ? `${profile.first_name} ${profile.last_name}` : "Unknown Patient",
          scheduled_at: apt.scheduled_at,
          consultation_type: apt.consultation_type as "video" | "phone" | "in_person",
          status: apt.status as QueuePatient["status"],
          symptoms: assessment?.symptoms || [],
          severity: assessment?.severity || "mild",
          symptom_description: assessment?.description || null,
          created_at: apt.created_at,
        };
      });

      setQueue(mergedQueue);

      // Calculate stats
      const newStats: QueueStats = {
        waiting: mergedQueue.filter(p => p.status === "pending" || p.status === "confirmed").length,
        inProgress: mergedQueue.filter(p => p.status === "in_progress").length,
        completed: mergedQueue.filter(p => p.status === "completed").length,
        total: mergedQueue.length,
      };
      setStats(newStats);

    } catch (err: any) {
      console.error("Error fetching queue:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateAppointmentStatus = async (appointmentId: string, status: QueuePatient["status"]) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status })
        .eq("id", appointmentId);

      if (error) throw error;

      // Update local state
      setQueue(prev => prev.map(p => 
        p.id === appointmentId ? { ...p, status } : p
      ));

      // Recalculate stats
      setStats(prev => {
        const updatedQueue = queue.map(p => 
          p.id === appointmentId ? { ...p, status } : p
        );
        return {
          waiting: updatedQueue.filter(p => p.status === "pending" || p.status === "confirmed").length,
          inProgress: updatedQueue.filter(p => p.status === "in_progress").length,
          completed: updatedQueue.filter(p => p.status === "completed").length,
          total: updatedQueue.length,
        };
      });

      return { success: true };
    } catch (err: any) {
      console.error("Error updating appointment:", err);
      return { success: false, error: err.message };
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Real-time subscription for appointment updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`clinician-queue-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `clinician_id=eq.${user.id}`,
        },
        () => {
          // Refetch queue when appointments change
          fetchQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchQueue]);

  return {
    queue,
    stats,
    loading,
    error,
    refetch: fetchQueue,
    updateAppointmentStatus,
  };
};
