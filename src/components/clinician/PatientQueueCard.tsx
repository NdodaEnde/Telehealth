import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Video, 
  Phone, 
  Building, 
  Clock, 
  AlertTriangle,
  Play,
  CheckCircle,
  User
} from "lucide-react";
import { format } from "date-fns";
import { QueuePatient } from "@/hooks/usePatientQueue";

interface PatientQueueCardProps {
  patient: QueuePatient;
  onStartConsultation: (patient: QueuePatient) => void;
  onCompleteConsultation: (patient: QueuePatient) => void;
  isUpdating: boolean;
}

const CONSULTATION_ICONS = {
  video: Video,
  phone: Phone,
  in_person: Building,
};

const STATUS_CONFIG = {
  pending: { label: "Waiting", variant: "secondary" as const, color: "text-muted-foreground" },
  confirmed: { label: "Confirmed", variant: "default" as const, color: "text-primary" },
  in_progress: { label: "In Progress", variant: "default" as const, color: "text-success" },
  completed: { label: "Completed", variant: "secondary" as const, color: "text-muted-foreground" },
  cancelled: { label: "Cancelled", variant: "destructive" as const, color: "text-destructive" },
};

const SEVERITY_CONFIG = {
  mild: { label: "Mild", color: "bg-success/10 text-success border-success/20" },
  moderate: { label: "Moderate", color: "bg-warning/10 text-warning border-warning/20" },
  severe: { label: "Severe", color: "bg-destructive/10 text-destructive border-destructive/20" },
};

export const PatientQueueCard = ({
  patient,
  onStartConsultation,
  onCompleteConsultation,
  isUpdating,
}: PatientQueueCardProps) => {
  const navigate = useNavigate();
  const ConsultationIcon = CONSULTATION_ICONS[patient.consultation_type];
  const statusConfig = STATUS_CONFIG[patient.status];
  const severityConfig = SEVERITY_CONFIG[patient.severity];

  const isWaiting = patient.status === "pending" || patient.status === "confirmed";
  const isInProgress = patient.status === "in_progress";
  const isCompleted = patient.status === "completed" || patient.status === "cancelled";

  const handleJoinCall = () => {
    navigate(`/consultation?appointment=${patient.id}`);
  };

  return (
    <Card className={`transition-all ${
      isInProgress ? "border-success ring-2 ring-success/20" : 
      patient.severity === "severe" ? "border-destructive/50" : ""
    }`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Patient Avatar */}
          <Avatar className="w-12 h-12">
            <AvatarFallback className="bg-primary/10 text-primary">
              {patient.patient_name.split(" ").map(n => n[0]).join("")}
            </AvatarFallback>
          </Avatar>

          {/* Patient Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold truncate">{patient.patient_name}</h3>
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            </div>

            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {format(new Date(patient.scheduled_at), "h:mm a")}
              </span>
              <span className="flex items-center gap-1">
                <ConsultationIcon className="w-3.5 h-3.5" />
                {patient.consultation_type === "video" ? "Video" : 
                 patient.consultation_type === "phone" ? "Phone" : "In-Person"}
              </span>
            </div>

            {/* Symptoms */}
            {patient.symptoms.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                <Badge variant="outline" className={severityConfig.color}>
                  {patient.severity === "severe" && <AlertTriangle className="w-3 h-3 mr-1" />}
                  {severityConfig.label}
                </Badge>
                {patient.symptoms.slice(0, 3).map((symptom, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {symptom}
                  </Badge>
                ))}
                {patient.symptoms.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{patient.symptoms.length - 3} more
                  </Badge>
                )}
              </div>
            )}

            {/* Description preview */}
            {patient.symptom_description && (
              <p className="text-sm text-muted-foreground line-clamp-1 mb-3">
                {patient.symptom_description}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {isWaiting && (
                <Button 
                  size="sm" 
                  onClick={() => onStartConsultation(patient)}
                  disabled={isUpdating}
                >
                  <Play className="w-4 h-4 mr-1" />
                  Start Consultation
                </Button>
              )}
              {isInProgress && (
                <>
                  <Button size="sm" variant="default" onClick={handleJoinCall}>
                    <Video className="w-4 h-4 mr-1" />
                    Join Call
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onCompleteConsultation(patient)}
                    disabled={isUpdating}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Complete
                  </Button>
                </>
              )}
              {isCompleted && (
                <Button size="sm" variant="outline" disabled>
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Completed
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
