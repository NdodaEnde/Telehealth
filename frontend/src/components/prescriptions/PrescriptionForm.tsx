import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Pill, Plus, Loader2 } from "lucide-react";
import { CreatePrescriptionData, usePrescriptions } from "@/hooks/usePrescriptions";
import { toast } from "sonner";

const prescriptionSchema = z.object({
  medication_name: z.string().min(1, "Medication name is required"),
  dosage: z.string().min(1, "Dosage is required"),
  frequency: z.string().min(1, "Frequency is required"),
  duration: z.string().min(1, "Duration is required"),
  quantity: z.string().optional(),
  refills: z.string().optional(),
  instructions: z.string().optional(),
  pharmacy_notes: z.string().optional(),
});

type PrescriptionFormValues = z.infer<typeof prescriptionSchema>;

const COMMON_FREQUENCIES = [
  "Once daily",
  "Twice daily",
  "Three times daily",
  "Four times daily",
  "Every 4 hours",
  "Every 6 hours",
  "Every 8 hours",
  "Every 12 hours",
  "Once weekly",
  "As needed",
  "At bedtime",
  "With meals",
];

const COMMON_DURATIONS = [
  "3 days",
  "5 days",
  "7 days",
  "10 days",
  "14 days",
  "21 days",
  "30 days",
  "60 days",
  "90 days",
  "Ongoing",
];

interface PrescriptionFormProps {
  patientId: string;
  patientName: string;
  appointmentId?: string;
  clinicalNoteId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const PrescriptionForm = ({
  patientId,
  patientName,
  appointmentId,
  clinicalNoteId,
  onSuccess,
  onCancel,
}: PrescriptionFormProps) => {
  const { createPrescription } = usePrescriptions();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PrescriptionFormValues>({
    resolver: zodResolver(prescriptionSchema),
    defaultValues: {
      medication_name: "",
      dosage: "",
      frequency: "",
      duration: "",
      quantity: "",
      refills: "0",
      instructions: "",
      pharmacy_notes: "",
    },
  });

  const onSubmit = async (values: PrescriptionFormValues) => {
    setIsSubmitting(true);

    const prescriptionData: CreatePrescriptionData = {
      patient_id: patientId,
      medication_name: values.medication_name,
      dosage: values.dosage,
      frequency: values.frequency,
      duration: values.duration,
      quantity: values.quantity ? parseInt(values.quantity) : undefined,
      refills: values.refills ? parseInt(values.refills) : 0,
      instructions: values.instructions || undefined,
      pharmacy_notes: values.pharmacy_notes || undefined,
      appointment_id: appointmentId,
      clinical_note_id: clinicalNoteId,
    };

    const result = await createPrescription(prescriptionData);
    setIsSubmitting(false);

    if (result.success) {
      toast.success("Prescription created successfully");
      form.reset();
      onSuccess?.();
    } else {
      toast.error(result.error || "Failed to create prescription");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="p-2 rounded-lg bg-primary/10">
          <Pill className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">New Prescription</h3>
          <p className="text-sm text-muted-foreground">For: {patientName}</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="medication_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Medication Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Amoxicillin 500mg" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="dosage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dosage *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 1 tablet" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frequency *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COMMON_FREQUENCIES.map((freq) => (
                        <SelectItem key={freq} value={freq}>
                          {freq}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COMMON_DURATIONS.map((dur) => (
                        <SelectItem key={dur} value={dur}>
                          {dur}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 30" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="refills"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Refills</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" max="12" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="instructions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Patient Instructions</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Special instructions for the patient..."
                    className="min-h-[80px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="pharmacy_notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pharmacy Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Notes for the pharmacist..."
                    className="min-h-[60px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-3 pt-4">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Prescription
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};
