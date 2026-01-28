import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Pill, Calendar, Clock, RefreshCw, User, CheckCircle, XCircle, AlertCircle, Download, Loader2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { formatSAST } from "@/lib/timezone";
import { prescriptionsAPI } from "@/lib/api";
import { toast } from "sonner";

interface PatientPrescription {
  id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number | null;
  refills: number;
  instructions: string | null;
  status: string;
  prescribed_at: string;
  clinician_name: string;
}

const STATUS_CONFIG = {
  active: { 
    label: "Active", 
    variant: "default" as const, 
    icon: CheckCircle,
  },
  cancelled: { 
    label: "Cancelled", 
    variant: "destructive" as const, 
    icon: XCircle,
  },
  expired: { 
    label: "Expired", 
    variant: "secondary" as const, 
    icon: AlertCircle,
  },
  completed: { 
    label: "Completed", 
    variant: "secondary" as const, 
    icon: CheckCircle,
  },
};

export const PatientPrescriptionHistory = () => {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState<PatientPrescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedPrescription, setSelectedPrescription] = useState<PatientPrescription | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  // Function to view prescription details
  const handleViewPrescription = (prescription: PatientPrescription) => {
    setSelectedPrescription(prescription);
    setViewDialogOpen(true);
  };

  // Function to download prescription PDF
  const handleDownloadPDF = async (prescriptionId: string, medicationName: string, e?: React.MouseEvent) => {
    // Prevent card click when clicking download button
    e?.stopPropagation();
    setDownloadingId(prescriptionId);
    try {
      const response = await prescriptionsAPI.getPDF(prescriptionId);
      
      if (response.success && response.pdf_base64) {
        // Convert base64 to blob and download
        const byteCharacters = atob(response.pdf_base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `prescription_${medicationName.replace(/\s+/g, '_')}_${prescriptionId.slice(0, 8)}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success("Prescription downloaded successfully");
      } else {
        throw new Error(response.error || "Failed to generate PDF");
      }
    } catch (error: any) {
      console.error("Error downloading prescription:", error);
      toast.error(error.message || "Failed to download prescription");
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    const fetchPrescriptions = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("prescriptions")
          .select("*")
          .eq("patient_id", user.id)
          .order("prescribed_at", { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          const clinicianIds = [...new Set(data.map(p => p.clinician_id))];
          
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", clinicianIds);

          const profileMap = new Map(
            profiles?.map(p => [p.id, `Dr. ${p.first_name} ${p.last_name}`]) || []
          );

          const enriched = data.map(p => ({
            id: p.id,
            medication_name: p.medication_name,
            dosage: p.dosage,
            frequency: p.frequency,
            duration: p.duration,
            quantity: p.quantity,
            refills: p.refills,
            instructions: p.instructions,
            status: p.status,
            prescribed_at: p.prescribed_at,
            clinician_name: profileMap.get(p.clinician_id) || "Unknown",
          }));

          setPrescriptions(enriched);
        }
      } catch (error) {
        console.error("Error fetching prescriptions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrescriptions();
  }, [user]);

  const activePrescriptions = prescriptions.filter(p => p.status === "active");
  const pastPrescriptions = prescriptions.filter(p => p.status !== "active");

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pill className="w-5 h-5 text-primary" />
          My Prescriptions
        </CardTitle>
        <CardDescription>
          {prescriptions.length} prescription(s) • {activePrescriptions.length} active
        </CardDescription>
      </CardHeader>
      <CardContent>
        {prescriptions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Pill className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No prescriptions yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Prescriptions */}
            {activePrescriptions.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Active Prescriptions</h3>
                <div className="space-y-3">
                  {activePrescriptions.map(prescription => {
                    const statusConfig = STATUS_CONFIG[prescription.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.active;
                    const StatusIcon = statusConfig.icon;

                    return (
                      <div
                        key={prescription.id}
                        className="p-4 rounded-lg border border-primary/30 bg-primary/5 cursor-pointer hover:border-primary hover:shadow-md transition-all"
                        onClick={() => handleViewPrescription(prescription)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <Pill className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-semibold">{prescription.medication_name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {prescription.dosage} • {prescription.frequency}
                              </p>
                            </div>
                          </div>
                          <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mt-3">
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
                          {prescription.refills > 0 && (
                            <div>
                              <span className="text-muted-foreground">Refills:</span>
                              <p className="font-medium">{prescription.refills}</p>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground">Prescribed:</span>
                            <p className="font-medium">
                              {format(new Date(prescription.prescribed_at), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>

                        {prescription.instructions && (
                          <div className="mt-3 p-2 bg-muted/50 rounded text-sm">
                            <span className="font-medium">Instructions:</span> {prescription.instructions}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 mt-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            {prescription.clinician_name}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleDownloadPDF(prescription.id, prescription.medication_name, e)}
                            disabled={downloadingId === prescription.id}
                          >
                            {downloadingId === prescription.id ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4 mr-1" />
                            )}
                            PDF
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Past Prescriptions */}
            {pastPrescriptions.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Past Prescriptions</h3>
                <div className="space-y-3">
                  {pastPrescriptions.map(prescription => {
                    const statusConfig = STATUS_CONFIG[prescription.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.completed;
                    const StatusIcon = statusConfig.icon;

                    return (
                      <div
                        key={prescription.id}
                        className="p-4 rounded-lg border border-border cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
                        onClick={() => handleViewPrescription(prescription)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-muted">
                              <Pill className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                              <h4 className="font-medium">{prescription.medication_name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {prescription.dosage} • {prescription.frequency} • {prescription.duration}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="text-right">
                              <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                                <StatusIcon className="w-3 h-3" />
                                {statusConfig.label}
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatSAST(prescription.prescribed_at, "MMM d, yyyy")}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => handleDownloadPDF(prescription.id, prescription.medication_name, e)}
                              disabled={downloadingId === prescription.id}
                            >
                              {downloadingId === prescription.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Prescription View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="w-5 h-5 text-primary" />
              Prescription Details
            </DialogTitle>
            <DialogDescription>
              {selectedPrescription && formatSAST(selectedPrescription.prescribed_at, "MMMM d, yyyy 'at' h:mm a")}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPrescription && (
            <div className="space-y-4">
              {/* Medication Info */}
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <h3 className="font-semibold text-lg">{selectedPrescription.medication_name}</h3>
                <p className="text-muted-foreground">{selectedPrescription.dosage}</p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Frequency</p>
                  <p className="font-medium">{selectedPrescription.frequency}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium">{selectedPrescription.duration}</p>
                </div>
                {selectedPrescription.quantity && (
                  <div>
                    <p className="text-sm text-muted-foreground">Quantity</p>
                    <p className="font-medium">{selectedPrescription.quantity}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Refills</p>
                  <p className="font-medium">{selectedPrescription.refills}</p>
                </div>
              </div>

              {/* Instructions */}
              {selectedPrescription.instructions && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">Instructions</p>
                  <p className="text-sm text-muted-foreground">{selectedPrescription.instructions}</p>
                </div>
              )}

              {/* Prescriber */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
                <User className="w-4 h-4" />
                <span>Prescribed by {selectedPrescription.clinician_name}</span>
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-between">
                {(() => {
                  const statusConfig = STATUS_CONFIG[selectedPrescription.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.active;
                  const StatusIcon = statusConfig.icon;
                  return (
                    <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                      <StatusIcon className="w-3 h-3" />
                      {statusConfig.label}
                    </Badge>
                  );
                })()}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => handleDownloadPDF(selectedPrescription.id, selectedPrescription.medication_name, e)}
                  disabled={downloadingId === selectedPrescription.id}
                >
                  {downloadingId === selectedPrescription.id ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Download PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
