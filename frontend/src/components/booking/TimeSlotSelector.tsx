import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Clock, Video, Phone, Building } from "lucide-react";
import { addDays, setHours, setMinutes, isBefore, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { formatSAST, formatFullDateSAST, TIMEZONE_ABBR } from "@/lib/timezone";

interface TimeSlotSelectorProps {
  clinicianId: string;
  clinicianName: string;
  onSelect: (data: {
    date: Date;
    time: string;
    consultationType: "video" | "phone" | "in_person";
  }) => void;
  onBack: () => void;
}

const CONSULTATION_TYPES = [
  { value: "video" as const, label: "Video Call", icon: Video, description: "Face-to-face via secure video" },
  { value: "phone" as const, label: "Phone Call", icon: Phone, description: "Voice consultation" },
  { value: "in_person" as const, label: "In Person", icon: Building, description: "Visit the clinic" },
];

const generateTimeSlots = (): string[] => {
  const slots: string[] = [];
  for (let hour = 8; hour < 18; hour++) {
    slots.push(`${hour.toString().padStart(2, "0")}:00`);
    slots.push(`${hour.toString().padStart(2, "0")}:30`);
  }
  return slots;
};

export const TimeSlotSelector = ({
  clinicianId,
  clinicianName,
  onSelect,
  onBack,
}: TimeSlotSelectorProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [consultationType, setConsultationType] = useState<"video" | "phone" | "in_person">("video");
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const timeSlots = generateTimeSlots();

  useEffect(() => {
    const fetchBookedSlots = async () => {
      if (!selectedDate) return;
      
      setLoading(true);
      try {
        const startOfSelectedDay = startOfDay(selectedDate);
        const endOfSelectedDay = addDays(startOfSelectedDay, 1);

        const { data, error } = await supabase
          .from("appointments")
          .select("scheduled_at")
          .eq("clinician_id", clinicianId)
          .gte("scheduled_at", startOfSelectedDay.toISOString())
          .lt("scheduled_at", endOfSelectedDay.toISOString())
          .in("status", ["pending", "confirmed"]);

        if (error) throw error;

        const booked = (data || []).map(apt => {
          const date = new Date(apt.scheduled_at);
          return format(date, "HH:mm");
        });

        setBookedSlots(booked);
      } catch (error) {
        console.error("Error fetching booked slots:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBookedSlots();
  }, [selectedDate, clinicianId]);

  const handleContinue = () => {
    if (selectedDate && selectedTime) {
      onSelect({
        date: selectedDate,
        time: selectedTime,
        consultationType,
      });
    }
  };

  const isSlotAvailable = (time: string) => {
    if (bookedSlots.includes(time)) return false;
    
    if (selectedDate) {
      const [hours, minutes] = time.split(":").map(Number);
      const slotDateTime = setMinutes(setHours(selectedDate, hours), minutes);
      if (isBefore(slotDateTime, new Date())) return false;
    }
    
    return true;
  };

  const isValid = selectedDate && selectedTime && consultationType;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Consultation Type</CardTitle>
          <CardDescription>
            How would you like to have your consultation with Dr. {clinicianName}?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {CONSULTATION_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <div
                  key={type.value}
                  className={`flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    consultationType === type.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => setConsultationType(type.value)}
                >
                  <Icon className={`w-8 h-8 mb-2 ${
                    consultationType === type.value ? "text-primary" : "text-muted-foreground"
                  }`} />
                  <span className="font-medium">{type.label}</span>
                  <span className="text-xs text-muted-foreground text-center mt-1">
                    {type.description}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Select Date</CardTitle>
            <CardDescription>Choose your preferred consultation date</CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => isBefore(date, startOfDay(new Date())) || date.getDay() === 0}
              className="rounded-md border pointer-events-auto"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Select Time
            </CardTitle>
            <CardDescription>
              {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : "Select a date first"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-10 bg-muted animate-pulse rounded-md" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                {timeSlots.map((time) => {
                  const available = isSlotAvailable(time);
                  return (
                    <Button
                      key={time}
                      variant={selectedTime === time ? "default" : "outline"}
                      size="sm"
                      disabled={!available}
                      className={!available ? "opacity-50 line-through" : ""}
                      onClick={() => setSelectedTime(time)}
                    >
                      {time}
                    </Button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedDate && selectedTime && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">Your Selected Appointment</p>
              <p className="text-sm text-muted-foreground">
                {format(selectedDate, "EEEE, MMMM d, yyyy")} at {selectedTime}
              </p>
            </div>
            <Badge variant="secondary">
              {CONSULTATION_TYPES.find(t => t.value === consultationType)?.label}
            </Badge>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleContinue} disabled={!isValid}>
          Review & Confirm
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};
