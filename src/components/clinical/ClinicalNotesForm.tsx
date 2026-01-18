import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ICD10Search } from "./ICD10Search";
import { 
  Save, 
  FileCheck, 
  Stethoscope, 
  Pill, 
  CalendarIcon, 
  AlertCircle,
  FileText,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const clinicalNotesSchema = z.object({
  chief_complaint: z.string().min(1, "Chief complaint is required").max(500),
  history_of_present_illness: z.string().max(2000).optional(),
  examination_findings: z.string().max(2000).optional(),
  treatment_plan: z.string().max(2000).optional(),
  follow_up_instructions: z.string().max(1000).optional(),
  follow_up_date: z.date().optional().nullable(),
  referral_required: z.boolean().default(false),
  referral_details: z.string().max(500).optional(),
});

type ClinicalNotesFormValues = z.infer<typeof clinicalNotesSchema>;

interface ICD10Code {
  code: string;
  description: string;
}

interface ClinicalNotesFormProps {
  appointmentId: string;
  patientId: string;
  patientName: string;
  onComplete?: () => void;
  existingNoteId?: string;
}

export const ClinicalNotesForm = ({
  appointmentId,
  patientId,
  patientName,
  onComplete,
  existingNoteId,
}: ClinicalNotesFormProps) => {
  const { user } = useAuth();
  const [icdCodes, setIcdCodes] = useState<ICD10Code[]>([]);
  const [saving, setSaving] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(existingNoteId || null);
  const [noteStatus, setNoteStatus] = useState<"draft" | "completed">("draft");

  const form = useForm<ClinicalNotesFormValues>({
    resolver: zodResolver(clinicalNotesSchema),
    defaultValues: {
      chief_complaint: "",
      history_of_present_illness: "",
      examination_findings: "",
      treatment_plan: "",
      follow_up_instructions: "",
      follow_up_date: null,
      referral_required: false,
      referral_details: "",
    },
  });

  // Load existing note if editing
  useEffect(() => {
    const loadExistingNote = async () => {
      if (!existingNoteId) return;

      const { data, error } = await supabase
        .from("clinical_notes")
        .select("*")
        .eq("id", existingNoteId)
        .single();

      if (error) {
        console.error("Error loading note:", error);
        return;
      }

      if (data) {
        form.reset({
          chief_complaint: data.chief_complaint || "",
          history_of_present_illness: data.history_of_present_illness || "",
          examination_findings: data.examination_findings || "",
          treatment_plan: data.treatment_plan || "",
          follow_up_instructions: data.follow_up_instructions || "",
          follow_up_date: data.follow_up_date ? new Date(data.follow_up_date) : null,
          referral_required: data.referral_required || false,
          referral_details: data.referral_details || "",
        });
        setIcdCodes((data.icd10_codes as unknown as ICD10Code[]) || []);
        setNoteStatus(data.status as "draft" | "completed");
        setNoteId(data.id);
      }
    };

    loadExistingNote();
  }, [existingNoteId, form]);

  const saveDraft = async (values: ClinicalNotesFormValues) => {
    if (!user) return;

    setSaving(true);
    try {
      const noteData = {
        appointment_id: appointmentId,
        clinician_id: user.id,
        patient_id: patientId,
        chief_complaint: values.chief_complaint,
        history_of_present_illness: values.history_of_present_illness || null,
        examination_findings: values.examination_findings || null,
        diagnosis: icdCodes.map((c) => c.description),
        icd10_codes: JSON.parse(JSON.stringify(icdCodes)),
        treatment_plan: values.treatment_plan || null,
        follow_up_instructions: values.follow_up_instructions || null,
        follow_up_date: values.follow_up_date
          ? format(values.follow_up_date, "yyyy-MM-dd")
          : null,
        referral_required: values.referral_required,
        referral_details: values.referral_required ? values.referral_details : null,
        status: "draft",
      };

      if (noteId) {
        const { error } = await supabase
          .from("clinical_notes")
          .update(noteData)
          .eq("id", noteId);

        if (error) throw error;
        toast.success("Draft saved");
      } else {
        const { data, error } = await supabase
          .from("clinical_notes")
          .insert(noteData)
          .select()
          .single();

        if (error) throw error;
        setNoteId(data.id);
        toast.success("Draft created");
      }
    } catch (error: any) {
      console.error("Error saving draft:", error);
      toast.error("Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const completeNote = async (values: ClinicalNotesFormValues) => {
    if (!user) return;

    if (icdCodes.length === 0) {
      toast.error("Please add at least one ICD-10 diagnosis code");
      return;
    }

    setSaving(true);
    try {
      const noteData = {
        appointment_id: appointmentId,
        clinician_id: user.id,
        patient_id: patientId,
        chief_complaint: values.chief_complaint,
        history_of_present_illness: values.history_of_present_illness || null,
        examination_findings: values.examination_findings || null,
        diagnosis: icdCodes.map((c) => c.description),
        icd10_codes: JSON.parse(JSON.stringify(icdCodes)),
        treatment_plan: values.treatment_plan || null,
        follow_up_instructions: values.follow_up_instructions || null,
        follow_up_date: values.follow_up_date
          ? format(values.follow_up_date, "yyyy-MM-dd")
          : null,
        referral_required: values.referral_required,
        referral_details: values.referral_required ? values.referral_details : null,
        status: "completed",
        signed_at: new Date().toISOString(),
      };

      if (noteId) {
        const { error } = await supabase
          .from("clinical_notes")
          .update(noteData)
          .eq("id", noteId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("clinical_notes").insert(noteData);

        if (error) throw error;
      }

      toast.success("Clinical note completed and signed");
      setNoteStatus("completed");
      onComplete?.();
    } catch (error: any) {
      console.error("Error completing note:", error);
      toast.error("Failed to complete note");
    } finally {
      setSaving(false);
    }
  };

  const isCompleted = noteStatus === "completed";

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Clinical Notes
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Patient: <span className="font-medium">{patientName}</span>
            </p>
          </div>
          <Badge variant={isCompleted ? "default" : "secondary"}>
            {isCompleted ? "Completed" : "Draft"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-6">
            <Tabs defaultValue="clinical" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="clinical" className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4" />
                  Clinical
                </TabsTrigger>
                <TabsTrigger value="diagnosis" className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Diagnosis
                </TabsTrigger>
                <TabsTrigger value="treatment" className="flex items-center gap-2">
                  <Pill className="w-4 h-4" />
                  Treatment
                </TabsTrigger>
              </TabsList>

              <TabsContent value="clinical" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="chief_complaint"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chief Complaint *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Patient presents with..."
                          className="min-h-[80px]"
                          disabled={isCompleted}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="history_of_present_illness"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>History of Present Illness</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Onset, duration, severity, associated symptoms..."
                          className="min-h-[120px]"
                          disabled={isCompleted}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="examination_findings"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Examination Findings</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Vital signs, physical examination findings..."
                          className="min-h-[120px]"
                          disabled={isCompleted}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Document any observable findings from the video consultation
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="diagnosis" className="space-y-4 mt-4">
                <div>
                  <FormLabel>ICD-10 Diagnosis Codes *</FormLabel>
                  <p className="text-sm text-muted-foreground mb-3">
                    Add relevant diagnosis codes for this consultation
                  </p>
                  <ICD10Search
                    selectedCodes={icdCodes}
                    onCodesChange={isCompleted ? () => {} : setIcdCodes}
                  />
                </div>
              </TabsContent>

              <TabsContent value="treatment" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="treatment_plan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Treatment Plan</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Medications, lifestyle modifications, recommendations..."
                          className="min-h-[120px]"
                          disabled={isCompleted}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="follow_up_instructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Follow-up Instructions</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="When to return, warning signs to watch for..."
                          className="min-h-[80px]"
                          disabled={isCompleted}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="follow_up_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Follow-up Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              disabled={isCompleted}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Select date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value || undefined}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="border-t pt-4">
                  <FormField
                    control={form.control}
                    name="referral_required"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Referral Required</FormLabel>
                          <FormDescription>
                            Does this patient need to be referred to a specialist?
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isCompleted}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch("referral_required") && (
                    <FormField
                      control={form.control}
                      name="referral_details"
                      render={({ field }) => (
                        <FormItem className="mt-4">
                          <FormLabel>Referral Details</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Specialist type, urgency, reason for referral..."
                              disabled={isCompleted}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {!isCompleted && (
              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={form.handleSubmit(saveDraft)}
                  disabled={saving}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Draft
                </Button>
                <Button
                  type="button"
                  onClick={form.handleSubmit(completeNote)}
                  disabled={saving}
                >
                  <FileCheck className="w-4 h-4 mr-2" />
                  Complete & Sign
                </Button>
              </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
