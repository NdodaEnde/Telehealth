import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClinicalNotesForm } from "./ClinicalNotesForm";

interface ClinicalNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  patientId: string;
  patientName: string;
  existingNoteId?: string;
  onComplete?: () => void;
}

export const ClinicalNotesDialog = ({
  open,
  onOpenChange,
  appointmentId,
  patientId,
  patientName,
  existingNoteId,
  onComplete,
}: ClinicalNotesDialogProps) => {
  const handleComplete = () => {
    onComplete?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Document Consultation</DialogTitle>
        </DialogHeader>
        <ClinicalNotesForm
          appointmentId={appointmentId}
          patientId={patientId}
          patientName={patientName}
          existingNoteId={existingNoteId}
          onComplete={handleComplete}
        />
      </DialogContent>
    </Dialog>
  );
};
