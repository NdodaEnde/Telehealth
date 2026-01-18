import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pill, Plus, CheckCircle, XCircle, Clock } from "lucide-react";
import { PrescriptionCard } from "./PrescriptionCard";
import { PrescriptionDialog } from "./PrescriptionDialog";
import { usePrescriptions, Prescription } from "@/hooks/usePrescriptions";
import { toast } from "sonner";

interface PrescriptionListProps {
  patientId?: string;
  patientName?: string;
  appointmentId?: string;
  showAddButton?: boolean;
  showPatient?: boolean;
}

export const PrescriptionList = ({
  patientId,
  patientName,
  appointmentId,
  showAddButton = true,
  showPatient = false,
}: PrescriptionListProps) => {
  const { 
    prescriptions, 
    loading, 
    updatePrescriptionStatus,
    getPrescriptionsForPatient,
    getPrescriptionsForAppointment,
  } = usePrescriptions();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filteredPrescriptions, setFilteredPrescriptions] = useState<Prescription[]>([]);
  const [localLoading, setLocalLoading] = useState(false);

  useEffect(() => {
    const fetchFiltered = async () => {
      if (appointmentId) {
        setLocalLoading(true);
        const result = await getPrescriptionsForAppointment(appointmentId);
        setFilteredPrescriptions(result.prescriptions || []);
        setLocalLoading(false);
      } else if (patientId) {
        setLocalLoading(true);
        const result = await getPrescriptionsForPatient(patientId);
        setFilteredPrescriptions(result.prescriptions || []);
        setLocalLoading(false);
      } else {
        setFilteredPrescriptions(prescriptions);
      }
    };

    fetchFiltered();
  }, [patientId, appointmentId, prescriptions, getPrescriptionsForPatient, getPrescriptionsForAppointment]);

  const handleCancelPrescription = async (id: string) => {
    const result = await updatePrescriptionStatus(id, "cancelled");
    if (result.success) {
      toast.success("Prescription cancelled");
    } else {
      toast.error("Failed to cancel prescription");
    }
  };

  const activePrescriptions = filteredPrescriptions.filter(p => p.status === "active");
  const completedPrescriptions = filteredPrescriptions.filter(p => p.status === "completed");
  const cancelledPrescriptions = filteredPrescriptions.filter(p => p.status === "cancelled" || p.status === "expired");

  const isLoading = loading || localLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2].map(i => (
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
          <div className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-primary" />
            <CardTitle>Prescriptions</CardTitle>
          </div>
          {showAddButton && patientId && patientName && (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              New Prescription
            </Button>
          )}
        </div>
        <CardDescription>
          {filteredPrescriptions.length} prescription(s) • {activePrescriptions.length} active
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="active" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Active ({activePrescriptions.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Completed ({completedPrescriptions.length})
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Cancelled ({cancelledPrescriptions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {activePrescriptions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Pill className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No active prescriptions</p>
              </div>
            ) : (
              activePrescriptions.map(prescription => (
                <PrescriptionCard
                  key={prescription.id}
                  prescription={prescription}
                  onCancel={handleCancelPrescription}
                  showPatient={showPatient}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedPrescriptions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No completed prescriptions</p>
              </div>
            ) : (
              completedPrescriptions.map(prescription => (
                <PrescriptionCard
                  key={prescription.id}
                  prescription={prescription}
                  showPatient={showPatient}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="cancelled" className="space-y-4">
            {cancelledPrescriptions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <XCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No cancelled prescriptions</p>
              </div>
            ) : (
              cancelledPrescriptions.map(prescription => (
                <PrescriptionCard
                  key={prescription.id}
                  prescription={prescription}
                  showPatient={showPatient}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {patientId && patientName && (
        <PrescriptionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          patientId={patientId}
          patientName={patientName}
          appointmentId={appointmentId}
        />
      )}
    </Card>
  );
};
