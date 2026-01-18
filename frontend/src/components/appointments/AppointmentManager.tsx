import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Calendar as CalendarIcon, 
  RefreshCw, 
  Clock, 
  CheckCircle,
  AlertCircle,
  ListFilter
} from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, isToday, isTomorrow } from "date-fns";
import { useClinicianAppointments } from "@/hooks/useClinicianAppointments";
import { AppointmentCard } from "./AppointmentCard";
import { cn } from "@/lib/utils";

export const AppointmentManager = () => {
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: startOfWeek(new Date(), { weekStartsOn: 1 }),
    end: endOfWeek(new Date(), { weekStartsOn: 1 }),
  });
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [statusFilter, setStatusFilter] = useState<string>("all");

  type AppointmentStatus = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
  
  const statusFilters: AppointmentStatus[] | undefined = statusFilter === "all" 
    ? undefined 
    : statusFilter === "active" 
      ? ["pending", "confirmed", "in_progress"]
      : [statusFilter as AppointmentStatus];

  const {
    appointments,
    loading,
    refetch,
    updateAppointmentStatus,
  } = useClinicianAppointments({
    startDate: dateRange.start,
    endDate: dateRange.end,
    status: statusFilters,
  });

  // Group appointments by date
  const groupedAppointments = appointments.reduce((acc, apt) => {
    const dateKey = format(new Date(apt.scheduled_at), "yyyy-MM-dd");
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(apt);
    return acc;
  }, {} as Record<string, typeof appointments>);

  // Stats
  const stats = {
    total: appointments.length,
    pending: appointments.filter((a) => a.status === "pending").length,
    confirmed: appointments.filter((a) => a.status === "confirmed").length,
    inProgress: appointments.filter((a) => a.status === "in_progress").length,
    completed: appointments.filter((a) => a.status === "completed").length,
  };

  const navigateWeek = (direction: "prev" | "next") => {
    const weeks = direction === "next" ? 1 : -1;
    setDateRange({
      start: addWeeks(dateRange.start, weeks),
      end: addWeeks(dateRange.end, weeks),
    });
  };

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "EEEE, MMM d");
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
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
              <CalendarIcon className="w-5 h-5 text-primary" />
              Appointments
            </CardTitle>
            <CardDescription>
              {format(dateRange.start, "MMM d")} - {format(dateRange.end, "MMM d, yyyy")}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigateWeek("prev")}>
              ← Prev
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigateWeek("next")}>
              Next →
            </Button>
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-4 mt-4 flex-wrap">
          <Badge variant="outline" className="px-3 py-1">
            <Clock className="w-3.5 h-3.5 mr-1" />
            {stats.pending} pending
          </Badge>
          <Badge variant="outline" className="px-3 py-1 border-primary/30 bg-primary/5">
            <CheckCircle className="w-3.5 h-3.5 mr-1" />
            {stats.confirmed} confirmed
          </Badge>
          <Badge variant="outline" className="px-3 py-1 border-success/30 bg-success/5">
            <AlertCircle className="w-3.5 h-3.5 mr-1" />
            {stats.inProgress} in progress
          </Badge>
          <Badge variant="secondary" className="px-3 py-1">
            {stats.completed} completed
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {/* Filter tabs */}
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
            <TabsTrigger value="active">Active ({stats.pending + stats.confirmed + stats.inProgress})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({stats.completed})</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Appointments list */}
        {Object.keys(groupedAppointments).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No appointments found</p>
            <p className="text-sm">
              {statusFilter !== "all"
                ? `No ${statusFilter} appointments for this week`
                : "No appointments scheduled for this week"}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedAppointments)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([dateStr, dayAppointments]) => (
                <div key={dateStr}>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    {getDateLabel(dateStr)}
                    <Badge variant="secondary" className="text-xs">
                      {dayAppointments.length} appointment{dayAppointments.length !== 1 ? "s" : ""}
                    </Badge>
                  </h3>
                  <div className="space-y-3">
                    {dayAppointments.map((appointment) => (
                      <AppointmentCard
                        key={appointment.id}
                        appointment={appointment}
                        onConfirm={(id) => updateAppointmentStatus(id, "confirmed")}
                        onCancel={(id) => updateAppointmentStatus(id, "cancelled")}
                        onStart={(id) => updateAppointmentStatus(id, "in_progress")}
                        onComplete={(id) => updateAppointmentStatus(id, "completed")}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
