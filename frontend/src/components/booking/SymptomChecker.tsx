import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowRight, Stethoscope, AlertTriangle, ThermometerSun } from "lucide-react";

const COMMON_SYMPTOMS = [
  { id: "headache", label: "Headache", category: "general" },
  { id: "fever", label: "Fever", category: "general" },
  { id: "cough", label: "Cough", category: "respiratory" },
  { id: "sore_throat", label: "Sore Throat", category: "respiratory" },
  { id: "fatigue", label: "Fatigue / Tiredness", category: "general" },
  { id: "body_aches", label: "Body Aches", category: "general" },
  { id: "nausea", label: "Nausea / Vomiting", category: "digestive" },
  { id: "diarrhea", label: "Diarrhea", category: "digestive" },
  { id: "shortness_breath", label: "Shortness of Breath", category: "respiratory" },
  { id: "chest_pain", label: "Chest Pain", category: "cardiac" },
  { id: "skin_rash", label: "Skin Rash", category: "dermatology" },
  { id: "joint_pain", label: "Joint Pain", category: "musculoskeletal" },
];

const SEVERITY_OPTIONS = [
  { value: "mild", label: "Mild", description: "Symptoms are present but manageable", icon: ThermometerSun },
  { value: "moderate", label: "Moderate", description: "Symptoms are affecting daily activities", icon: Stethoscope },
  { value: "severe", label: "Severe", description: "Symptoms are significantly impacting quality of life", icon: AlertTriangle },
];

interface SymptomCheckerProps {
  onComplete: (data: {
    symptoms: string[];
    severity: "mild" | "moderate" | "severe";
    description: string;
    recommendedSpecialization: string | null;
  }) => void;
  onBack: () => void;
}

const getRecommendedSpecialization = (symptoms: string[]): string | null => {
  const categories = symptoms.map(s => {
    const symptom = COMMON_SYMPTOMS.find(cs => cs.id === s);
    return symptom?.category;
  }).filter(Boolean);

  const categoryCounts: Record<string, number> = {};
  categories.forEach(cat => {
    if (cat) categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  const specializationMap: Record<string, string> = {
    respiratory: "Pulmonology",
    cardiac: "Cardiology",
    digestive: "Gastroenterology",
    dermatology: "Dermatology",
    musculoskeletal: "Orthopedics",
    general: "General Practice",
  };

  return topCategory ? specializationMap[topCategory] || "General Practice" : null;
};

export const SymptomChecker = ({ onComplete, onBack }: SymptomCheckerProps) => {
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [severity, setSeverity] = useState<"mild" | "moderate" | "severe">("mild");
  const [description, setDescription] = useState("");

  const handleSymptomToggle = (symptomId: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(symptomId)
        ? prev.filter(s => s !== symptomId)
        : [...prev, symptomId]
    );
  };

  const handleSubmit = () => {
    const symptomLabels = selectedSymptoms.map(id => {
      const symptom = COMMON_SYMPTOMS.find(s => s.id === id);
      return symptom?.label || id;
    });

    onComplete({
      symptoms: symptomLabels,
      severity,
      description,
      recommendedSpecialization: getRecommendedSpecialization(selectedSymptoms),
    });
  };

  const isValid = selectedSymptoms.length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-primary" />
            What symptoms are you experiencing?
          </CardTitle>
          <CardDescription>
            Select all symptoms that apply. This helps us match you with the right clinician.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {COMMON_SYMPTOMS.map((symptom) => (
              <div
                key={symptom.id}
                className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors cursor-pointer ${
                  selectedSymptoms.includes(symptom.id)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => handleSymptomToggle(symptom.id)}
              >
                <Checkbox
                  id={symptom.id}
                  checked={selectedSymptoms.includes(symptom.id)}
                  onCheckedChange={() => handleSymptomToggle(symptom.id)}
                />
                <Label htmlFor={symptom.id} className="cursor-pointer text-sm">
                  {symptom.label}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How severe are your symptoms?</CardTitle>
          <CardDescription>
            This helps prioritize your consultation appropriately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={severity}
            onValueChange={(value) => setSeverity(value as "mild" | "moderate" | "severe")}
            className="grid md:grid-cols-3 gap-4"
          >
            {SEVERITY_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <div key={option.value}>
                  <RadioGroupItem
                    value={option.value}
                    id={option.value}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={option.value}
                    className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      severity === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Icon className={`w-8 h-8 mb-2 ${
                      option.value === "severe" ? "text-destructive" :
                      option.value === "moderate" ? "text-warning" : "text-success"
                    }`} />
                    <span className="font-medium">{option.label}</span>
                    <span className="text-xs text-muted-foreground text-center mt-1">
                      {option.description}
                    </span>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Additional Details (Optional)</CardTitle>
          <CardDescription>
            Provide any additional information about your symptoms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Describe when your symptoms started, any triggers, medications you've tried, etc."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleSubmit} disabled={!isValid}>
          Continue to Select Clinician
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};
