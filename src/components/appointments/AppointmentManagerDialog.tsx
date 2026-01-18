import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppointmentManager } from "./AppointmentManager";

interface AppointmentManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AppointmentManagerDialog = ({
  open,
  onOpenChange,
}: AppointmentManagerDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Appointments</DialogTitle>
        </DialogHeader>
        <AppointmentManager />
      </DialogContent>
    </Dialog>
  );
};
