import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Calendar,
  FileText,
  Pill,
  Clock,
  User,
  Video,
  Phone,
  Building,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { usePatientHistory } from "@/hooks/usePatientHistory";

interface PatientHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
}

const CONSULTATION_ICONS = {
  video: Video,
  phone: Phone,
  in_person: Building,
};

const STATUS_COLORS = {
  completed: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
  pending: "bg-warning/10 text-warning",
  confirmed: "bg-primary/10 text-primary",
  in_progress: "bg-primary/10 text-primary",
  active: "bg-success/10 text-success",
};

export const PatientHistoryDialog = ({
  open,
  onOpenChange,
  patientId,
  patientName,
}: PatientHistoryDialogProps) => {
  const { history, loading, error } = usePatientHistory(open ? patientId : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Medical History: {patientName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive">
            <AlertCircle className="w-12 h-12 mx-auto mb-4" />
            <p>Error loading patient history</p>
          </div>
        ) : (
          <Tabs defaultValue="appointments" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="appointments" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Visits ({history.appointments.length})
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Clinical Notes ({history.clinicalNotes.length})
              </TabsTrigger>
              <TabsTrigger value="prescriptions" className="flex items-center gap-2">
                <Pill className="w-4 h-4" />
                Prescriptions ({history.prescriptions.length})
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[500px] pr-4">
              <TabsContent value="appointments" className="space-y-3 mt-0">
                {history.appointments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No past appointments</p>
                  </div>
                ) : (
                  history.appointments.map((apt) => {
                    const ConsultationIcon = CONSULTATION_ICONS[apt.consultation_type as keyof typeof CONSULTATION_ICONS] || Video;
                    return (
                      <Card key={apt.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <ConsultationIcon className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-medium">
                                    {format(new Date(apt.scheduled_at), "MMMM d, yyyy")}
                                  </p>
                                  <span className="text-sm text-muted-foreground">
                                    at {format(new Date(apt.scheduled_at), "h:mm a")}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                  {apt.clinician_name} • {apt.duration_minutes} min {apt.consultation_type} consultation
                                </p>
                                {apt.notes && (
                                  <p className="text-sm bg-muted/50 p-2 rounded">
                                    {apt.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Badge className={STATUS_COLORS[apt.status as keyof typeof STATUS_COLORS] || ""}>
                              {apt.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </TabsContent>

              <TabsContent value="notes" className="space-y-3 mt-0">
                {history.clinicalNotes.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No clinical notes available</p>
                  </div>
                ) : (
                  history.clinicalNotes.map((note) => (
                    <Card key={note.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-primary" />
                            <p className="font-medium">
                              {format(new Date(note.created_at), "MMMM d, yyyy")}
                            </p>
                          </div>
                          {note.signed_at && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Signed
                            </Badge>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground mb-3">
                          {note.clinician_name}
                        </p>

                        {note.chief_complaint && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                              Chief Complaint
                            </p>
                            <p className="text-sm">{note.chief_complaint}</p>
                          </div>
                        )}

                        {note.diagnosis && note.diagnosis.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                              Diagnosis
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {note.diagnosis.map((d, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {d}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {note.treatment_plan && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase mb-1">
                              Treatment Plan
                            </p>
                            <p className="text-sm">{note.treatment_plan}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="prescriptions" className="space-y-3 mt-0">
                {history.prescriptions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Pill className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No prescriptions on record</p>
                  </div>
                ) : (
                  history.prescriptions.map((rx) => (
                    <Card key={rx.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-warning/10">
                              <Pill className="w-5 h-5 text-warning" />
                            </div>
                            <div>
                              <p className="font-medium">{rx.medication_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {rx.dosage} • {rx.frequency} • {rx.duration}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {rx.clinician_name} • {format(new Date(rx.prescribed_at), "MMM d, yyyy")}
                              </p>
                            </div>
                          </div>
                          <Badge className={STATUS_COLORS[rx.status as keyof typeof STATUS_COLORS] || ""}>
                            {rx.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
