import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle, Stethoscope, Activity, Brain, Eye, Heart,
  Thermometer, ChevronRight, ChevronLeft, Loader2, AlertCircle,
  CheckCircle2, Phone, ArrowRight
} from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || '';

interface SymptomCategory {
  category: string;
  symptoms: string[];
}

interface AssessmentResult {
  urgency: string;
  urgency_score: number;
  care_pathway: string;
  recommended_specialization?: string;
  assessment_summary: string;
  warning_signs: string[];
  self_care_advice?: string;
  follow_up_questions: string[];
  disclaimer: string;
}

const CATEGORY_ICONS: Record<string, any> = {
  "General": Thermometer,
  "Head & Neurological": Brain,
  "Eyes, Ears, Nose, Throat": Eye,
  "Respiratory": Activity,
  "Cardiovascular": Heart,
  "Gastrointestinal": Stethoscope,
  "Urinary": Activity,
  "Musculoskeletal": Activity,
  "Skin": Activity,
  "Mental Health": Brain,
};

const URGENCY_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  emergency: { color: "text-red-600", bgColor: "bg-red-100", label: "EMERGENCY" },
  urgent: { color: "text-orange-600", bgColor: "bg-orange-100", label: "Urgent" },
  soon: { color: "text-yellow-600", bgColor: "bg-yellow-100", label: "Soon" },
  routine: { color: "text-green-600", bgColor: "bg-green-100", label: "Routine" },
};

interface AISymptomCheckerProps {
  onComplete?: (result: AssessmentResult) => void;
  onBookAppointment?: (result: AssessmentResult) => void;
}

export const AISymptomChecker = ({ onComplete, onBookAppointment }: AISymptomCheckerProps) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<SymptomCategory[]>([]);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [severity, setSeverity] = useState<string>("moderate");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [result, setResult] = useState<AssessmentResult | null>(null);

  useEffect(() => {
    fetchSymptomCategories();
  }, []);

  const fetchSymptomCategories = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/symptoms/common`);
      const data = await response.json();
      setCategories(data.symptom_categories || []);
    } catch (error) {
      console.error("Failed to fetch symptoms:", error);
    }
  };

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms(prev => 
      prev.includes(symptom)
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const handleAssess = async () => {
    if (selectedSymptoms.length === 0) {
      toast.error("Please select at least one symptom");
      return;
    }

    setLoading(true);
    try {
      // Get auth token
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${BACKEND_URL}/api/symptoms/assess`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` })
        },
        body: JSON.stringify({
          symptoms: selectedSymptoms,
          severity,
          description: description || undefined,
          duration: duration || undefined
        })
      });

      if (!response.ok) {
        throw new Error("Assessment failed");
      }

      const assessmentResult = await response.json();
      setResult(assessmentResult);
      setStep(4);
      onComplete?.(assessmentResult);
    } catch (error) {
      console.error("Assessment error:", error);
      toast.error("Failed to complete assessment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;
  const urgencyConfig = result ? URGENCY_CONFIG[result.urgency] || URGENCY_CONFIG.routine : null;

  return (
    <div className="max-w-3xl mx-auto">
      {step < 4 && (
        <div className="mb-6">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground mt-2">Step {step} of 3 - Symptom Assessment</p>
        </div>
      )}

      {/* Step 1: Select Symptoms */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-primary" />
              What symptoms are you experiencing?
            </CardTitle>
            <CardDescription>Select all that apply</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {categories.map((category) => {
              const Icon = CATEGORY_ICONS[category.category] || Activity;
              return (
                <div key={category.category} className="space-y-2">
                  <h3 className="font-medium flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    {category.category}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {category.symptoms.map((symptom) => (
                      <Badge
                        key={symptom}
                        variant={selectedSymptoms.includes(symptom) ? "default" : "outline"}
                        className="cursor-pointer py-1.5 px-3"
                        onClick={() => toggleSymptom(symptom)}
                      >
                        {symptom}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}

            {selectedSymptoms.length > 0 && (
              <div className="p-4 bg-primary/5 rounded-lg">
                <p className="text-sm font-medium mb-2">Selected symptoms ({selectedSymptoms.length}):</p>
                <div className="flex flex-wrap gap-2">
                  {selectedSymptoms.map(s => (
                    <Badge key={s} variant="secondary">{s}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Severity & Duration */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              How severe are your symptoms?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <RadioGroup value={severity} onValueChange={setSeverity} className="space-y-3">
              <div className="flex items-center space-x-3 p-4 rounded-lg border hover:border-primary cursor-pointer">
                <RadioGroupItem value="mild" id="mild" />
                <Label htmlFor="mild" className="flex-1 cursor-pointer">
                  <span className="font-medium">Mild</span>
                  <p className="text-sm text-muted-foreground">
                    Noticeable but not significantly affecting daily activities
                  </p>
                </Label>
                <Badge variant="outline" className="bg-green-50 text-green-700">Low</Badge>
              </div>
              <div className="flex items-center space-x-3 p-4 rounded-lg border hover:border-primary cursor-pointer">
                <RadioGroupItem value="moderate" id="moderate" />
                <Label htmlFor="moderate" className="flex-1 cursor-pointer">
                  <span className="font-medium">Moderate</span>
                  <p className="text-sm text-muted-foreground">
                    Affecting daily activities, requiring rest or medication
                  </p>
                </Label>
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Medium</Badge>
              </div>
              <div className="flex items-center space-x-3 p-4 rounded-lg border hover:border-primary cursor-pointer">
                <RadioGroupItem value="severe" id="severe" />
                <Label htmlFor="severe" className="flex-1 cursor-pointer">
                  <span className="font-medium">Severe</span>
                  <p className="text-sm text-muted-foreground">
                    Significantly impacting daily life, intense discomfort
                  </p>
                </Label>
                <Badge variant="outline" className="bg-red-50 text-red-700">High</Badge>
              </div>
            </RadioGroup>

            <div className="space-y-2">
              <Label>How long have you had these symptoms?</Label>
              <RadioGroup value={duration} onValueChange={setDuration} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {["Few hours", "1-2 days", "3-7 days", "Over a week"].map((d) => (
                  <div key={d} className="flex items-center space-x-2">
                    <RadioGroupItem value={d} id={d} />
                    <Label htmlFor={d} className="text-sm cursor-pointer">{d}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Additional Details */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Tell us more (optional)
            </CardTitle>
            <CardDescription>
              Any additional details that might help with your assessment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Describe your symptoms in your own words</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., The headache started suddenly this morning, worse on the right side..."
                rows={4}
              />
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Summary:</p>
              <p className="text-sm text-muted-foreground">
                <strong>Symptoms:</strong> {selectedSymptoms.join(", ")}<br />
                <strong>Severity:</strong> {severity}<br />
                <strong>Duration:</strong> {duration || "Not specified"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Results */}
      {step === 4 && result && (
        <div className="space-y-6">
          {/* Emergency Banner */}
          {result.urgency === "emergency" && (
            <Card className="border-red-500 bg-red-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                    <Phone className="w-8 h-8 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-red-700">Emergency - Seek Immediate Care</h2>
                    <p className="text-red-600">Call emergency services (10177) or go to the nearest emergency room</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Assessment Result */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  Assessment Complete
                </CardTitle>
                {urgencyConfig && (
                  <Badge className={`${urgencyConfig.bgColor} ${urgencyConfig.color}`}>
                    {urgencyConfig.label}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary */}
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm leading-relaxed">{result.assessment_summary}</p>
              </div>

              {/* Urgency Score */}
              <div>
                <Label className="text-sm text-muted-foreground">Urgency Level</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={result.urgency_score * 10} className="h-3 flex-1" />
                  <span className="font-bold text-lg">{result.urgency_score}/10</span>
                </div>
              </div>

              {/* Care Pathway */}
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">Recommended Care Pathway</h3>
                <p className="text-muted-foreground">
                  {result.care_pathway === "emergency_services" && "Seek emergency medical services immediately"}
                  {result.care_pathway === "urgent_consultation" && "Book an urgent telehealth consultation"}
                  {result.care_pathway === "nurse_triage" && "Speak with a nurse for initial assessment"}
                  {result.care_pathway === "doctor_consultation" && "Schedule a doctor consultation"}
                  {result.care_pathway === "specialist_referral" && "You may need to see a specialist"}
                  {result.care_pathway === "self_care" && "Self-care may be appropriate with monitoring"}
                </p>
                {result.recommended_specialization && (
                  <p className="text-sm mt-2">
                    <strong>Recommended:</strong> {result.recommended_specialization.replace('_', ' ')}
                  </p>
                )}
              </div>

              {/* Warning Signs */}
              {result.warning_signs.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h3 className="font-medium text-red-700 flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    Warning Signs to Watch For
                  </h3>
                  <ul className="text-sm text-red-600 space-y-1">
                    {result.warning_signs.map((sign, i) => (
                      <li key={i}>• {sign}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Self Care Advice */}
              {result.self_care_advice && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h3 className="font-medium text-green-700 mb-2">Self-Care Advice</h3>
                  <p className="text-sm text-green-600">{result.self_care_advice}</p>
                </div>
              )}

              {/* Disclaimer */}
              <p className="text-xs text-muted-foreground italic">
                {result.disclaimer}
              </p>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {result.urgency !== "emergency" && (
              <Button 
                className="flex-1" 
                size="lg"
                onClick={() => onBookAppointment?.(result)}
              >
                Book Consultation
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
            <Button 
              variant="outline" 
              className="flex-1" 
              size="lg"
              onClick={() => {
                setStep(1);
                setSelectedSymptoms([]);
                setResult(null);
              }}
            >
              Start New Assessment
            </Button>
          </div>
        </div>
      )}

      {/* Navigation */}
      {step < 4 && (
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={() => setStep(s => s - 1)}
            disabled={step === 1}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {step < 3 ? (
            <Button 
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && selectedSymptoms.length === 0}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleAssess} disabled={loading}>
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
              ) : (
                <><Brain className="w-4 h-4 mr-2" /> Get AI Assessment</>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
