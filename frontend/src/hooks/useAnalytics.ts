import { useState, useEffect, useCallback } from "react";

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || '';

export interface AnalyticsOverview {
  total_users: number;
  total_patients: number;
  total_clinicians: number;
  total_appointments: number;
  total_consultations: number;
  total_prescriptions: number;
  appointments_today: number;
  appointments_this_week: number;
  appointments_this_month: number;
  completion_rate: number;
  average_consultation_duration: number;
}

export interface AppointmentTrend {
  date: string;
  count: number;
  completed: number;
  cancelled: number;
}

export interface ConsultationTypeStats {
  video: number;
  phone: number;
  in_person: number;
}

export interface ClinicianPerformance {
  clinician_id: string;
  clinician_name: string;
  total_appointments: number;
  completed_appointments: number;
  completion_rate: number;
  average_rating?: number;
}

export interface PatientGrowth {
  date: string;
  total_patients: number;
  new_patients: number;
}

export interface AnalyticsDashboard {
  overview: AnalyticsOverview;
  appointment_trends: AppointmentTrend[];
  consultation_types: ConsultationTypeStats;
  clinician_performance: ClinicianPerformance[];
  patient_growth: PatientGrowth[];
  status_distribution: Record<string, number>;
}

export const useAnalytics = (days: number = 30) => {
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/analytics/dashboard?days=${days}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      console.error('Analytics fetch error:', err);
      setError(err.message);
      
      // Set default empty data
      setData({
        overview: {
          total_users: 0,
          total_patients: 0,
          total_clinicians: 0,
          total_appointments: 0,
          total_consultations: 0,
          total_prescriptions: 0,
          appointments_today: 0,
          appointments_this_week: 0,
          appointments_this_month: 0,
          completion_rate: 0,
          average_consultation_duration: 0
        },
        appointment_trends: [],
        consultation_types: { video: 0, phone: 0, in_person: 0 },
        clinician_performance: [],
        patient_growth: [],
        status_distribution: {}
      });
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    data,
    loading,
    error,
    refetch: fetchAnalytics
  };
};
