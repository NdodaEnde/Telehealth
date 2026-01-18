import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Video, 
  Phone, 
  Building, 
  Clock, 
  MoreVertical,
  CheckCircle,
  XCircle,
  Calendar,
  FileText,
  Play,
  AlertTriangle,
  User
} from "lucide-react";
import { format } from "date-fns";
import { ClinicianAppointment } from "@/hooks/useClinicianAppointments";
import { ClinicalNotesDialog } from "@/components/clinical/ClinicalNotesDialog";

interface AppointmentCardProps {
  appointment: ClinicianAppointment;
  onConfirm: (id: string) => Promise<boolean>;
  onCancel: (id: string) => Promise<boolean>;
  onStart: (id: string) => Promise<boolean>;
  onComplete: (id: string) => Promise<boolean>;
  compact?: boolean;
}

const CONSULTATION_ICONS = {
  video: Video,
  phone: Phone,
  in_person: Building,
};

const STATUS_CONFIG = {
  pending: { label: "Pending", variant: "secondary" as const, color: "bg-warning/10 text-warning border-warning/20" },
  confirmed: { label: "Confirmed", variant: "default" as const, color: "bg-primary/10 text-primary border-primary/20" },
  in_progress: { label: "In Progress", variant: "default" as const, color: "bg-success/10 text-success border-success/20" },
  completed: { label: "Completed", variant: "secondary" as const, color: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelled", variant: "destructive" as const, color: "bg-destructive/10 text-destructive border-destructive/20" },
};

const SEVERITY_CONFIG = {
  mild: { label: "Mild", color: "text-success" },
  moderate: { label: "Moderate", color: "text-warning" },
  severe: { label: "Severe", color: "text-destructive" },
};

export const AppointmentCard = ({
  appointment,
  onConfirm,
  onCancel,
  onStart,
  onComplete,
  compact = false,
}: AppointmentCardProps) => {
  const navigate = useNavigate();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const ConsultationIcon = CONSULTATION_ICONS[appointment.consultation_type];
  const statusConfig = STATUS_CONFIG[appointment.status];
  const severityConfig = SEVERITY_CONFIG[appointment.severity];

  const isPending = appointment.status === "pending";
  const isConfirmed = appointment.status === "confirmed";
  const isInProgress = appointment.status === "in_progress";
  const isActive = isPending || isConfirmed || isInProgress;

  const handleAction = async (action: () => Promise<boolean>) => {
    setIsUpdating(true);
    await action();
    setIsUpdating(false);
  };

  const handleJoinCall = () => {
    navigate(`/consultation?appointment=${appointment.id}`);
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${statusConfig.color}`}>
            <ConsultationIcon className="w-4 h-4" />
          </div>
          <div>
            <p className="font-medium text-sm">{appointment.patient_name}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(appointment.scheduled_at), "h:mm a")}
            </p>
          </div>
        </div>
        <Badge variant={statusConfig.variant} className="text-xs">
          {statusConfig.label}
        </Badge>
      </div>
    );
  }

  return (
    <>
      <Card className={`transition-all ${isInProgress ? "ring-2 ring-success/50" : ""}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className={`p-3 rounded-xl ${statusConfig.color} border`}>
                <ConsultationIcon className="w-5 h-5" />
              </div>

              {/* Info */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{appointment.patient_name}</h3>
                  <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(new Date(appointment.scheduled_at), "MMM d, yyyy")}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {format(new Date(appointment.scheduled_at), "h:mm a")}
                  </span>
                  <span>{appointment.duration_minutes} min</span>
                </div>

                {/* Symptoms */}
                {appointment.symptoms.length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs font-medium ${severityConfig.color}`}>
                      {appointment.severity === "severe" && (
                        <AlertTriangle className="w-3 h-3 inline mr-1" />
                      )}
                      {severityConfig.label}
                    </span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">
                      {appointment.symptoms.slice(0, 3).join(", ")}
                      {appointment.symptoms.length > 3 && ` +${appointment.symptoms.length - 3} more`}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-3">
                  {isPending && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleAction(() => onConfirm(appointment.id))}
                        disabled={isUpdating}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCancelDialogOpen(true)}
                        disabled={isUpdating}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                    </>
                  )}
                  {isConfirmed && (
                    <Button
                      size="sm"
                      onClick={() => handleAction(() => onStart(appointment.id))}
                      disabled={isUpdating}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Start Consultation
                    </Button>
                  )}
                  {isInProgress && (
                    <>
                      <Button size="sm" onClick={handleJoinCall}>
                        <Video className="w-4 h-4 mr-1" />
                        Join Call
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setNotesDialogOpen(true)}
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        Notes
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction(() => onComplete(appointment.id))}
                        disabled={isUpdating}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Complete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Dropdown menu */}
            {isActive && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setNotesDialogOpen(true)}>
                    <FileText className="w-4 h-4 mr-2" />
                    Clinical Notes
                  </DropdownMenuItem>
                  {appointment.patient_phone && (
                    <DropdownMenuItem asChild>
                      <a href={`tel:${appointment.patient_phone}`}>
                        <Phone className="w-4 h-4 mr-2" />
                        Call Patient
                      </a>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setCancelDialogOpen(true)}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancel Appointment
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cancel confirmation dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Appointment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this appointment with{" "}
              <strong>{appointment.patient_name}</strong>? The patient will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Appointment</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => handleAction(() => onCancel(appointment.id))}
            >
              Cancel Appointment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clinical notes dialog */}
      <ClinicalNotesDialog
        open={notesDialogOpen}
        onOpenChange={setNotesDialogOpen}
        appointmentId={appointment.id}
        patientId={appointment.patient_id}
        patientName={appointment.patient_name}
      />
    </>
  );
};
