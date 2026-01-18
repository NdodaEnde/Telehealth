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
  AlertCircle,
  Download,
  FileText,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { Prescription } from "@/hooks/usePrescriptions";
import { usePrescriptionPDF } from "@/hooks/usePrescriptionPDF";

interface PrescriptionCardProps {
  prescription: Prescription;
  onCancel?: (id: string) => void;
  showPatient?: boolean;
  showClinician?: boolean;
  clinicianQualification?: string;
  clinicianHPCSA?: string;
  patientDOB?: string;
  patientIDNumber?: string;
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
  clinicianQualification,
  clinicianHPCSA,
  patientDOB,
  patientIDNumber,
}: PrescriptionCardProps) => {
  const statusConfig = STATUS_CONFIG[prescription.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.active;
  const StatusIcon = statusConfig.icon;
  const { loading: pdfLoading, downloadPDF } = usePrescriptionPDF();

  const handleDownloadPDF = async () => {
    await downloadPDF({
      prescription_id: prescription.id,
      patient_name: prescription.patient_name || 'Patient',
      patient_dob: patientDOB,
      patient_id_number: patientIDNumber,
      clinician_name: prescription.clinician_name || 'Clinician',
      clinician_qualification: clinicianQualification,
      clinician_hpcsa: clinicianHPCSA,
      medication_name: prescription.medication_name,
      dosage: prescription.dosage,
      frequency: prescription.frequency,
      duration: prescription.duration,
      quantity: prescription.quantity || undefined,
      refills: prescription.refills,
      instructions: prescription.instructions || undefined,
      pharmacy_notes: prescription.pharmacy_notes || undefined,
      prescribed_at: prescription.prescribed_at,
      expires_at: prescription.expires_at || undefined,
    });
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
          <div className="hidden sm:flex p-3 rounded-xl bg-primary/10 shrink-0">
            <Pill className="w-6 h-6 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start sm:items-center justify-between mb-2 gap-2">
              <div className="flex items-center gap-2 sm:hidden">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Pill className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-semibold text-base truncate">
                  {prescription.medication_name}
                </h3>
              </div>
              <h3 className="hidden sm:block font-semibold text-lg truncate">
                {prescription.medication_name}
              </h3>
              <Badge variant={statusConfig.variant} className="flex items-center gap-1 shrink-0 text-xs">
                <StatusIcon className="w-3 h-3" />
                <span className="hidden xs:inline">{statusConfig.label}</span>
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-sm mb-3">
              <div>
                <span className="text-muted-foreground text-xs">Dosage:</span>
                <p className="font-medium text-sm">{prescription.dosage}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Frequency:</span>
                <p className="font-medium text-sm">{prescription.frequency}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Duration:</span>
                <p className="font-medium text-sm">{prescription.duration}</p>
              </div>
              {prescription.quantity && (
                <div>
                  <span className="text-muted-foreground text-xs">Quantity:</span>
                  <p className="font-medium text-sm">{prescription.quantity}</p>
                </div>
              )}
            </div>

            {prescription.instructions && (
              <div className="bg-muted/50 rounded-lg p-2 sm:p-3 mb-3">
                <p className="text-xs sm:text-sm">
                  <span className="font-medium">Instructions:</span> {prescription.instructions}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                {format(new Date(prescription.prescribed_at), "MMM d, yyyy")}
              </span>
              
              {prescription.refills > 0 && (
                <span className="flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
                  {prescription.refills} refills
                </span>
              )}

              {showPatient && prescription.patient_name && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3 sm:w-4 sm:h-4" />
                  {prescription.patient_name}
                </span>
              )}

              {showClinician && prescription.clinician_name && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3 sm:w-4 sm:h-4" />
                  Dr. {prescription.clinician_name}
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPDF}
                disabled={pdfLoading}
                className="text-primary hover:text-primary gap-1"
              >
                {pdfLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span className="hidden xs:inline">Download PDF</span>
                <span className="xs:hidden">PDF</span>
              </Button>

              {onCancel && prescription.status === "active" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCancel(prescription.id)}
                  className="text-destructive hover:text-destructive gap-1"
                >
                  <XCircle className="w-4 h-4" />
                  <span className="hidden xs:inline">Cancel</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
