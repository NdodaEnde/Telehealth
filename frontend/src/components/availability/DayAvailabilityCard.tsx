import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Clock, Trash2, Moon } from "lucide-react";
import { AvailabilitySlot } from "@/hooks/useClinicianAvailability";

interface DayAvailabilityCardProps {
  dayName: string;
  dayIndex: number;
  slots: AvailabilitySlot[];
  onToggleActive: (slotId: string, isActive: boolean) => void;
  onDeleteSlot: (slotId: string) => void;
  saving: boolean;
}

const formatTime = (time: string) => {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

export const DayAvailabilityCard = ({
  dayName,
  dayIndex,
  slots,
  onToggleActive,
  onDeleteSlot,
  saving,
}: DayAvailabilityCardProps) => {
  const activeSlots = slots.filter((s) => s.is_active);
  const hasSlots = slots.length > 0;
  const isWeekend = dayIndex === 0 || dayIndex === 6;

  return (
    <Card className={`${!hasSlots ? "opacity-60" : ""} ${isWeekend ? "bg-muted/30" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {dayName}
            {isWeekend && <Moon className="w-3.5 h-3.5 text-muted-foreground" />}
          </CardTitle>
          {hasSlots && (
            <Badge variant={activeSlots.length > 0 ? "default" : "secondary"}>
              {activeSlots.length} active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasSlots ? (
          <p className="text-sm text-muted-foreground py-2">No slots configured</p>
        ) : (
          <div className="space-y-2">
            {slots.map((slot) => (
              <div
                key={slot.id}
                className={`flex items-center justify-between p-2 rounded-lg border ${
                  slot.is_active
                    ? "bg-primary/5 border-primary/20"
                    : "bg-muted/50 border-border"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={slot.is_active}
                    onCheckedChange={(checked) =>
                      slot.id && onToggleActive(slot.id, checked)
                    }
                    disabled={saving}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => slot.id && onDeleteSlot(slot.id)}
                    disabled={saving}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
