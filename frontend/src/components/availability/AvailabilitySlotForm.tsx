import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";

interface AvailabilitySlotFormProps {
  onAddSlot: (slot: {
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
  }) => Promise<any>;
  saving: boolean;
  dayNames: string[];
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2);
  const minutes = i % 2 === 0 ? "00" : "30";
  return `${hours.toString().padStart(2, "0")}:${minutes}`;
});

export const AvailabilitySlotForm = ({
  onAddSlot,
  saving,
  dayNames,
}: AvailabilitySlotFormProps) => {
  const [dayOfWeek, setDayOfWeek] = useState<number>(1); // Monday
  const [startTime, setStartTime] = useState<string>("09:00");
  const [endTime, setEndTime] = useState<string>("17:00");
  const [isActive, setIsActive] = useState(true);

  const handleSubmit = async () => {
    if (startTime >= endTime) {
      return;
    }

    const result = await onAddSlot({
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      is_active: isActive,
    });

    if (result) {
      // Reset form
      setStartTime("09:00");
      setEndTime("17:00");
    }
  };

  return (
    <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-4">
      <h3 className="font-medium">Add New Time Slot</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>Day</Label>
          <Select
            value={dayOfWeek.toString()}
            onValueChange={(v) => setDayOfWeek(parseInt(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dayNames.map((day, index) => (
                <SelectItem key={index} value={index.toString()}>
                  {day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Start Time</Label>
          <Select value={startTime} onValueChange={setStartTime}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map((time) => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>End Time</Label>
          <Select value={endTime} onValueChange={setEndTime}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.filter((t) => t > startTime).map((time) => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Active</Label>
          <div className="flex items-center h-10">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <span className="ml-2 text-sm text-muted-foreground">
              {isActive ? "Visible" : "Hidden"}
            </span>
          </div>
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={saving || startTime >= endTime}>
        <Plus className="w-4 h-4 mr-2" />
        Add Slot
      </Button>
    </div>
  );
};
