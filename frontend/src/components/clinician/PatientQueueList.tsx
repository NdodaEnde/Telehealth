import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { PatientQueueCard } from "./PatientQueueCard";
import { QueuePatient, usePatientQueue } from "@/hooks/usePatientQueue";
import { toast } from "sonner";

export const PatientQueueList = () => {
  const { queue, stats, loading, updateAppointmentStatus } = usePatientQueue();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const waitingPatients = queue.filter(p => p.status === "pending" || p.status === "confirmed");
  const inProgressPatients = queue.filter(p => p.status === "in_progress");
  const completedPatients = queue.filter(p => p.status === "completed");

  // Sort by severity (severe first) then by time
  const sortBySeverityAndTime = (patients: QueuePatient[]) => {
    return [...patients].sort((a, b) => {
      const severityOrder = { severe: 0, moderate: 1, mild: 2 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
    });
  };

  const handleStartConsultation = async (patient: QueuePatient) => {
    setUpdatingId(patient.id);
    const result = await updateAppointmentStatus(patient.id, "in_progress");
    setUpdatingId(null);

    if (result.success) {
      toast.success(`Started consultation with ${patient.patient_name}`);
    } else {
      toast.error("Failed to start consultation");
    }
  };

  const handleCompleteConsultation = async (patient: QueuePatient) => {
    setUpdatingId(patient.id);
    const result = await updateAppointmentStatus(patient.id, "completed");
    setUpdatingId(null);

    if (result.success) {
      toast.success(`Completed consultation with ${patient.patient_name}`);
    } else {
      toast.error("Failed to complete consultation");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Patient Queue
        </CardTitle>
        <CardDescription>
          {stats.total} patients today • {stats.waiting} waiting • {stats.inProgress} in progress
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="waiting" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="waiting" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Waiting ({stats.waiting})
            </TabsTrigger>
            <TabsTrigger value="in_progress" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              In Progress ({stats.inProgress})
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Completed ({stats.completed})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="waiting" className="space-y-4">
            {waitingPatients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No patients waiting</p>
              </div>
            ) : (
              sortBySeverityAndTime(waitingPatients).map(patient => (
                <PatientQueueCard
                  key={patient.id}
                  patient={patient}
                  onStartConsultation={handleStartConsultation}
                  onCompleteConsultation={handleCompleteConsultation}
                  isUpdating={updatingId === patient.id}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="in_progress" className="space-y-4">
            {inProgressPatients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No consultations in progress</p>
              </div>
            ) : (
              inProgressPatients.map(patient => (
                <PatientQueueCard
                  key={patient.id}
                  patient={patient}
                  onStartConsultation={handleStartConsultation}
                  onCompleteConsultation={handleCompleteConsultation}
                  isUpdating={updatingId === patient.id}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedPatients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No completed consultations today</p>
              </div>
            ) : (
              completedPatients.map(patient => (
                <PatientQueueCard
                  key={patient.id}
                  patient={patient}
                  onStartConsultation={handleStartConsultation}
                  onCompleteConsultation={handleCompleteConsultation}
                  isUpdating={updatingId === patient.id}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
