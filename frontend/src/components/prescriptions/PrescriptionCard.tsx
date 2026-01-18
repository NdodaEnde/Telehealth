import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Pill, 
  Calendar, 
  Clock, 
  RefreshCw, 
  User,
  XCircle,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { Prescription } from "@/hooks/usePrescriptions";

interface PrescriptionCardProps {
  prescription: Prescription;
  onCancel?: (id: string) => void;
  showPatient?: boolean;
  showClinician?: boolean;
}

const STATUS_CONFIG = {
  active: { 
    label: "Active", 
    variant: "default" as const, 
    icon: CheckCircle,
    color: "text-success" 
  },
  cancelled: { 
    label: "Cancelled", 
    variant: "destructive" as const, 
    icon: XCircle,
    color: "text-destructive" 
  },
  expired: { 
    label: "Expired", 
    variant: "secondary" as const, 
    icon: AlertCircle,
    color: "text-muted-foreground" 
  },
  completed: { 
    label: "Completed", 
    variant: "secondary" as const, 
    icon: CheckCircle,
    color: "text-muted-foreground" 
  },
};

export const PrescriptionCard = ({
  prescription,
  onCancel,
  showPatient = false,
  showClinician = false,
}: PrescriptionCardProps) => {
  const statusConfig = STATUS_CONFIG[prescription.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.active;
  const StatusIcon = statusConfig.icon;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/10">
            <Pill className="w-6 h-6 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-lg truncate">
                {prescription.medication_name}
              </h3>
              <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                <StatusIcon className="w-3 h-3" />
                {statusConfig.label}
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
              <div>
                <span className="text-muted-foreground">Dosage:</span>
                <p className="font-medium">{prescription.dosage}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Frequency:</span>
                <p className="font-medium">{prescription.frequency}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Duration:</span>
                <p className="font-medium">{prescription.duration}</p>
              </div>
              {prescription.quantity && (
                <div>
                  <span className="text-muted-foreground">Quantity:</span>
                  <p className="font-medium">{prescription.quantity}</p>
                </div>
              )}
            </div>

            {prescription.instructions && (
              <div className="bg-muted/50 rounded-lg p-3 mb-3">
                <p className="text-sm">
                  <span className="font-medium">Instructions:</span> {prescription.instructions}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {format(new Date(prescription.prescribed_at), "MMM d, yyyy")}
              </span>
              
              {prescription.refills > 0 && (
                <span className="flex items-center gap-1">
                  <RefreshCw className="w-4 h-4" />
                  {prescription.refills} refills
                </span>
              )}

              {showPatient && prescription.patient_name && (
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {prescription.patient_name}
                </span>
              )}

              {showClinician && prescription.clinician_name && (
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  Dr. {prescription.clinician_name}
                </span>
              )}
            </div>

            {onCancel && prescription.status === "active" && (
              <div className="mt-3 pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCancel(prescription.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Cancel Prescription
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
