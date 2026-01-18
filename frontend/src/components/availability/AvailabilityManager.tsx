import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, RefreshCw, Clock } from "lucide-react";
import { useClinicianAvailability } from "@/hooks/useClinicianAvailability";
import { AvailabilitySlotForm } from "./AvailabilitySlotForm";
import { DayAvailabilityCard } from "./DayAvailabilityCard";

export const AvailabilityManager = () => {
  const {
    availability,
    loading,
    saving,
    addSlot,
    toggleSlotActive,
    deleteSlot,
    getSlotsByDay,
    refetch,
    DAY_NAMES,
  } = useClinicianAvailability();

  // Calculate total hours
  const totalActiveHours = availability
    .filter((slot) => slot.is_active)
    .reduce((total, slot) => {
      const [startH, startM] = slot.start_time.split(":").map(Number);
      const [endH, endM] = slot.end_time.split(":").map(Number);
      const hours = endH - startH + (endM - startM) / 60;
      return total + hours;
    }, 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Availability Schedule
            </CardTitle>
            <CardDescription className="mt-1">
              Set your working hours for patient appointments
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Weekly hours</p>
              <p className="text-lg font-semibold flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {totalActiveHours.toFixed(1)}h
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add new slot form */}
        <AvailabilitySlotForm
          onAddSlot={addSlot}
          saving={saving}
          dayNames={DAY_NAMES}
        />

        {/* Week overview */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Weekly Schedule
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {DAY_NAMES.map((dayName, index) => (
              <DayAvailabilityCard
                key={index}
                dayName={dayName}
                dayIndex={index}
                slots={getSlotsByDay(index)}
                onToggleActive={toggleSlotActive}
                onDeleteSlot={deleteSlot}
                saving={saving}
              />
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2">Tips for setting availability</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Patients can only book during your active time slots</li>
            <li>• Each appointment is 30 minutes by default</li>
            <li>• Toggle slots off to temporarily block bookings without deleting</li>
            <li>• Add multiple slots per day for split schedules (e.g., morning + afternoon)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
