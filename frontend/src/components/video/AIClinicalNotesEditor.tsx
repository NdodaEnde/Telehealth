import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, FileText, Mic, Wand2, Save, CheckCircle2, 
  AlertCircle, ArrowLeft, RefreshCw, Sparkles 
} from "lucide-react";
import { aiClinicalNotesAPI } from "@/lib/api";
import { toast } from "sonner";

interface AIClinicalNotesEditorProps {
  appointmentId: string;
  patientName: string;
  clinicianName: string;
  audioBlob?: Blob | null;
  onClose: () => void;
}

export const AIClinicalNotesEditor = ({
  appointmentId,
  patientName,
  clinicianName,
  audioBlob,
  onClose,
}: AIClinicalNotesEditorProps) => {
  const [step, setStep] = useState<'processing' | 'editing' | 'saved'>('processing');
  const [transcript, setTranscript] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGeneratingSoap, setIsGeneratingSoap] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // SOAP fields
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  // Process audio on mount
  useEffect(() => {
    if (audioBlob && audioBlob.size > 0) {
      processAudio();
    } else {
      // No audio - go directly to editing mode with empty fields
      setStep('editing');
      toast.info("No audio recording available. Please enter notes manually or paste a transcript.");
    }
  }, []);

  const processAudio = async () => {
    if (!audioBlob) return;
    
    setIsTranscribing(true);
    setError(null);
    
    try {
      // Transcribe and get SOAP notes in one call
      const result = await aiClinicalNotesAPI.transcribe(audioBlob, appointmentId);
      
      if (result?.success) {
        setTranscript(result.transcript || "");
        setSubjective(result.soap_notes?.subjective || "");
        setObjective(result.soap_notes?.objective || "");
        setAssessment(result.soap_notes?.assessment || "");
        setPlan(result.soap_notes?.plan || "");
        setStep('editing');
        toast.success("Transcription complete! Please review and edit the notes.");
      } else {
        throw new Error("Failed to process audio");
      }
    } catch (err: any) {
      console.error("Processing error:", err);
      setError(err.message || "Failed to process audio");
      setStep('editing');
      toast.error("Audio processing failed. Please enter notes manually.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const regenerateSoap = async () => {
    if (!transcript.trim()) {
      toast.error("Please enter a transcript first");
      return;
    }
    
    setIsGeneratingSoap(true);
    try {
      const result = await aiClinicalNotesAPI.generateSoap(appointmentId, transcript);
      
      if (result?.success && result.soap_notes) {
        setSubjective(result.soap_notes.subjective || "");
        setObjective(result.soap_notes.objective || "");
        setAssessment(result.soap_notes.assessment || "");
        setPlan(result.soap_notes.plan || "");
        toast.success("SOAP notes regenerated!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to regenerate SOAP notes");
    } finally {
      setIsGeneratingSoap(false);
    }
  };

  const handleSave = async () => {
    if (!subjective.trim() && !objective.trim() && !assessment.trim() && !plan.trim()) {
      toast.error("Please fill in at least one SOAP section");
      return;
    }
    
    setIsSaving(true);
    try {
      const result = await aiClinicalNotesAPI.save({
        appointment_id: appointmentId,
        transcript: transcript,
        soap_subjective: subjective,
        soap_objective: objective,
        soap_assessment: assessment,
        soap_plan: plan,
        additional_notes: additionalNotes || undefined,
      });
      
      if (result?.success) {
        setStep('saved');
        toast.success("Clinical notes saved successfully!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save notes");
    } finally {
      setIsSaving(false);
    }
  };

  // Processing state
  if (step === 'processing' && isTranscribing) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center">
            <div className="relative">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <Sparkles className="w-6 h-6 text-yellow-500 absolute -top-2 -right-2 animate-pulse" />
            </div>
            <h3 className="text-lg font-semibold mt-4">Processing Consultation Audio</h3>
            <p className="text-muted-foreground mt-2 text-center">
              Transcribing audio and generating SOAP notes...
              <br />
              <span className="text-sm">This may take a minute.</span>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Saved state - show summary of saved notes with option to view/edit
  if (step === 'saved') {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <CardTitle>Clinical Notes Saved!</CardTitle>
              <CardDescription>
                Consultation with {patientName} • Notes saved to patient record
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Summary of saved notes */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-4">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Saved Notes Summary
            </h4>
            
            <div className="grid gap-3">
              {subjective && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">S</span>
                    <span className="font-medium text-sm">Subjective</span>
                  </div>
                  <p className="text-sm text-muted-foreground pl-7 line-clamp-2">{subjective}</p>
                </div>
              )}
              
              {objective && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">O</span>
                    <span className="font-medium text-sm">Objective</span>
                  </div>
                  <p className="text-sm text-muted-foreground pl-7 line-clamp-2">{objective}</p>
                </div>
              )}
              
              {assessment && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">A</span>
                    <span className="font-medium text-sm">Assessment</span>
                  </div>
                  <p className="text-sm text-muted-foreground pl-7 line-clamp-2">{assessment}</p>
                </div>
              )}
              
              {plan && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">P</span>
                    <span className="font-medium text-sm">Plan</span>
                  </div>
                  <p className="text-sm text-muted-foreground pl-7 line-clamp-2">{plan}</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="outline" 
              onClick={() => setStep('editing')}
              className="flex-1"
            >
              <FileText className="w-4 h-4 mr-2" />
              Edit Notes
            </Button>
            <Button onClick={onClose} className="flex-1">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Dashboard
            </Button>
          </div>
          
          <p className="text-xs text-center text-muted-foreground">
            You can view and edit these notes later from the patient's clinical history.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Editing state
  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Clinical Notes
            </CardTitle>
            <CardDescription>
              Consultation with {patientName}
            </CardDescription>
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            AI-Assisted
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Audio Processing Issue</p>
              <p className="text-sm text-amber-700">{error}</p>
              <p className="text-sm text-amber-600 mt-1">You can still enter notes manually below.</p>
            </div>
          </div>
        )}
        
        <Tabs defaultValue="soap" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="soap">SOAP Notes</TabsTrigger>
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
          </TabsList>
          
          <TabsContent value="soap" className="space-y-4 mt-4">
            {/* Subjective */}
            <div className="space-y-2">
              <Label htmlFor="subjective" className="text-base font-semibold flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">S</span>
                Subjective
              </Label>
              <Textarea
                id="subjective"
                value={subjective}
                onChange={(e) => setSubjective(e.target.value)}
                placeholder="Patient's chief complaint, history of present illness, symptoms..."
                className="min-h-[100px]"
              />
            </div>
            
            {/* Objective */}
            <div className="space-y-2">
              <Label htmlFor="objective" className="text-base font-semibold flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-green-100 text-green-700 flex items-center justify-center text-sm font-bold">O</span>
                Objective
              </Label>
              <Textarea
                id="objective"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Vital signs, physical examination findings, observable data..."
                className="min-h-[100px]"
              />
            </div>
            
            {/* Assessment */}
            <div className="space-y-2">
              <Label htmlFor="assessment" className="text-base font-semibold flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-bold">A</span>
                Assessment
              </Label>
              <Textarea
                id="assessment"
                value={assessment}
                onChange={(e) => setAssessment(e.target.value)}
                placeholder="Clinical impression, diagnosis, differential diagnoses..."
                className="min-h-[100px]"
              />
            </div>
            
            {/* Plan */}
            <div className="space-y-2">
              <Label htmlFor="plan" className="text-base font-semibold flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold">P</span>
                Plan
              </Label>
              <Textarea
                id="plan"
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                placeholder="Treatment plan, medications, follow-up, referrals..."
                className="min-h-[100px]"
              />
            </div>
            
            {/* Additional Notes */}
            <div className="space-y-2">
              <Label htmlFor="additional" className="text-base font-semibold">
                Additional Notes (Optional)
              </Label>
              <Textarea
                id="additional"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Any additional notes or observations..."
                className="min-h-[80px]"
              />
            </div>
            
            {/* Regenerate Button */}
            {transcript && (
              <Button 
                variant="outline" 
                onClick={regenerateSoap}
                disabled={isGeneratingSoap}
                className="w-full"
              >
                {isGeneratingSoap ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4 mr-2" />
                )}
                Regenerate SOAP from Transcript
              </Button>
            )}
          </TabsContent>
          
          <TabsContent value="transcript" className="space-y-4 mt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="transcript" className="text-base font-semibold flex items-center gap-2">
                  <Mic className="w-4 h-4" />
                  Consultation Transcript
                </Label>
                <Badge variant="secondary" className="text-xs">
                  Audit Trail
                </Badge>
              </div>
              <Textarea
                id="transcript"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="The consultation transcript will appear here after processing, or you can paste/type one manually..."
                className="min-h-[300px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                This transcript is saved for audit purposes. You can edit it for accuracy.
              </p>
            </div>
          </TabsContent>
        </Tabs>
        
        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="flex-1">
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Clinical Notes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIClinicalNotesEditor;
