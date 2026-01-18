import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Video, Phone, Building } from "lucide-react";
import { QueuePatient } from "@/hooks/usePatientQueue";
import { formatSAST, formatFullDateSAST, TIMEZONE_ABBR } from "@/lib/timezone";

interface UpcomingScheduleProps {
  todayAppointments: QueuePatient[];
}

const CONSULTATION_ICONS = {
  video: Video,
  phone: Phone,
  in_person: Building,
};

export const UpcomingSchedule = ({ todayAppointments }: UpcomingScheduleProps) => {
  // Group by time blocks
  const morning = todayAppointments.filter(apt => {
    const hour = new Date(apt.scheduled_at).getHours();
    return hour >= 8 && hour < 12;
  });

  const afternoon = todayAppointments.filter(apt => {
    const hour = new Date(apt.scheduled_at).getHours();
    return hour >= 12 && hour < 17;
  });

  const evening = todayAppointments.filter(apt => {
    const hour = new Date(apt.scheduled_at).getHours();
    return hour >= 17;
  });

  const TimeBlock = ({ title, appointments }: { title: string; appointments: QueuePatient[] }) => (
    <div className="mb-4 last:mb-0">
      <h4 className="text-sm font-medium text-muted-foreground mb-2">{title}</h4>
      {appointments.length === 0 ? (
        <p className="text-sm text-muted-foreground/50 italic">No appointments</p>
      ) : (
        <div className="space-y-2">
          {appointments.map(apt => {
            const Icon = CONSULTATION_ICONS[apt.consultation_type];
            return (
              <div
                key={apt.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  apt.status === "in_progress" 
                    ? "border-success bg-success/5" 
                    : apt.status === "completed"
                    ? "border-muted bg-muted/50 opacity-60"
                    : "border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-medium">
                      {formatSAST(new Date(apt.scheduled_at), "h:mm")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatSAST(new Date(apt.scheduled_at), "a")}
                    </span>
                  </div>
                  <div className="w-px h-8 bg-border" />
                  <div>
                    <p className="font-medium text-sm">{apt.patient_name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Icon className="w-3 h-3" />
                      <span>{apt.consultation_type}</span>
                    </div>
                  </div>
                </div>
                <Badge 
                  variant={
                    apt.status === "in_progress" ? "default" :
                    apt.status === "completed" ? "secondary" : "outline"
                  }
                  className="text-xs"
                >
                  {apt.status === "in_progress" ? "In Progress" :
                   apt.status === "completed" ? "Done" : 
                   apt.status === "pending" ? "Waiting" : apt.status}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Today's Schedule
        </CardTitle>
        <CardDescription>
          {format(new Date(), "EEEE, MMMM d, yyyy")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {todayAppointments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No appointments scheduled for today</p>
          </div>
        ) : (
          <>
            <TimeBlock title="Morning (8am - 12pm)" appointments={morning} />
            <TimeBlock title="Afternoon (12pm - 5pm)" appointments={afternoon} />
            <TimeBlock title="Evening (5pm+)" appointments={evening} />
          </>
        )}
      </CardContent>
    </Card>
  );
};
