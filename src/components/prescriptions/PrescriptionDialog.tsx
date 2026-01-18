import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PrescriptionForm } from "./PrescriptionForm";

interface PrescriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
  appointmentId?: string;
  clinicalNoteId?: string;
}

export const PrescriptionDialog = ({
  open,
  onOpenChange,
  patientId,
  patientName,
  appointmentId,
  clinicalNoteId,
}: PrescriptionDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create E-Prescription</DialogTitle>
        </DialogHeader>
        <PrescriptionForm
          patientId={patientId}
          patientName={patientName}
          appointmentId={appointmentId}
          clinicalNoteId={clinicalNoteId}
          onSuccess={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};
