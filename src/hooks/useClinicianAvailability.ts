import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AvailabilitySlot {
  id?: string;
  clinician_id: string;
  day_of_week: number; // 0 = Sunday, 6 = Saturday
  start_time: string; // HH:MM format
  end_time: string;
  is_active: boolean;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const useClinicianAvailability = () => {
  const { user } = useAuth();
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchAvailability = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("clinician_availability")
        .select("*")
        .eq("clinician_id", user.id)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      setAvailability(data || []);
    } catch (err: any) {
      console.error("Error fetching availability:", err);
      toast.error("Failed to load availability");
    } finally {
      setLoading(false);
    }
  }, [user]);

  const addSlot = useCallback(
    async (slot: Omit<AvailabilitySlot, "id" | "clinician_id">) => {
      if (!user) return;

      setSaving(true);
      try {
        const { data, error } = await supabase
          .from("clinician_availability")
          .insert({
            clinician_id: user.id,
            day_of_week: slot.day_of_week,
            start_time: slot.start_time,
            end_time: slot.end_time,
            is_active: slot.is_active,
          })
          .select()
          .single();

        if (error) throw error;
        setAvailability((prev) => [...prev, data]);
        toast.success("Availability slot added");
        return data;
      } catch (err: any) {
        console.error("Error adding slot:", err);
        toast.error("Failed to add availability slot");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [user]
  );

  const updateSlot = useCallback(
    async (slotId: string, updates: Partial<AvailabilitySlot>) => {
      if (!user) return;

      setSaving(true);
      try {
        const { error } = await supabase
          .from("clinician_availability")
          .update(updates)
          .eq("id", slotId)
          .eq("clinician_id", user.id);

        if (error) throw error;

        setAvailability((prev) =>
          prev.map((slot) => (slot.id === slotId ? { ...slot, ...updates } : slot))
        );
        toast.success("Availability updated");
      } catch (err: any) {
        console.error("Error updating slot:", err);
        toast.error("Failed to update availability");
      } finally {
        setSaving(false);
      }
    },
    [user]
  );

  const deleteSlot = useCallback(
    async (slotId: string) => {
      if (!user) return;

      setSaving(true);
      try {
        const { error } = await supabase
          .from("clinician_availability")
          .delete()
          .eq("id", slotId)
          .eq("clinician_id", user.id);

        if (error) throw error;

        setAvailability((prev) => prev.filter((slot) => slot.id !== slotId));
        toast.success("Slot removed");
      } catch (err: any) {
        console.error("Error deleting slot:", err);
        toast.error("Failed to remove slot");
      } finally {
        setSaving(false);
      }
    },
    [user]
  );

  const toggleSlotActive = useCallback(
    async (slotId: string, isActive: boolean) => {
      await updateSlot(slotId, { is_active: isActive });
    },
    [updateSlot]
  );

  const getSlotsByDay = useCallback(
    (dayOfWeek: number) => {
      return availability.filter((slot) => slot.day_of_week === dayOfWeek);
    },
    [availability]
  );

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  return {
    availability,
    loading,
    saving,
    addSlot,
    updateSlot,
    deleteSlot,
    toggleSlotActive,
    getSlotsByDay,
    refetch: fetchAvailability,
    DAY_NAMES,
  };
};
