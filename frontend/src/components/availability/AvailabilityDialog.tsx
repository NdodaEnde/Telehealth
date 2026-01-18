import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AvailabilityManager } from "./AvailabilityManager";

interface AvailabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AvailabilityDialog = ({
  open,
  onOpenChange,
}: AvailabilityDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Availability</DialogTitle>
        </DialogHeader>
        <AvailabilityManager />
      </DialogContent>
    </Dialog>
  );
};
