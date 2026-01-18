import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  User, IdCard, Phone, MapPin, Heart, Pill, AlertTriangle,
  CheckCircle2, Loader2, ChevronRight, ChevronLeft, Shield
} from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || '';

interface MedicalAidScheme {
  code: string;
  name: string;
  plans: string[];
}

interface Allergy {
  allergen: string;
  reaction: string;
  severity: string;
}

interface ChronicCondition {
  condition: string;
  diagnosed_date?: string;
  medications?: string[];
}

interface OnboardingData {
  // Basic Info
  first_name: string;
  last_name: string;
  id_number: string;
  date_of_birth: string;
  gender: string;
  email: string;
  phone: string;
  alternative_phone: string;
  // Address
  address_line_1: string;
  address_line_2: string;
  city: string;
  province: string;
  postal_code: string;
  // Emergency Contact
  emergency_contact_name: string;
  emergency_contact_relationship: string;
  emergency_contact_phone: string;
  // Medical Aid
  has_medical_aid: boolean;
  medical_aid_scheme: string;
  medical_aid_number: string;
  medical_aid_plan: string;
  medical_aid_dependent_code: string;
  // Medical History
  allergies: Allergy[];
  chronic_conditions: ChronicCondition[];
  current_medications: string[];
  past_surgeries: string[];
  blood_type: string;
  smoking_status: string;
  alcohol_use: string;
  // Consent
  consent_telehealth: boolean;
  consent_data_processing: boolean;
  consent_marketing: boolean;
}

const PROVINCES = [
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal",
  "Limpopo", "Mpumalanga", "Northern Cape", "North West", "Western Cape"
];

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-", "unknown"];

const COMMON_ALLERGIES = [
  "Penicillin", "Sulfa drugs", "Aspirin", "NSAIDs", "Codeine",
  "Peanuts", "Tree nuts", "Shellfish", "Eggs", "Milk", "Wheat",
  "Latex", "Bee stings", "Pollen", "Dust mites"
];

const COMMON_CONDITIONS = [
  "Diabetes Type 1", "Diabetes Type 2", "Hypertension", "Asthma",
  "COPD", "Heart Disease", "Epilepsy", "Arthritis", "HIV/AIDS",
  "Thyroid Disorder", "Depression", "Anxiety", "Cancer"
];

interface PatientOnboardingProps {
  onComplete?: () => void;
  prefilledIdNumber?: string;
  prefilledData?: {
    date_of_birth?: string;
    gender?: string;
    age?: number;
  };
}

export const PatientOnboarding = ({ onComplete, prefilledIdNumber, prefilledData }: PatientOnboardingProps) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [medicalAidSchemes, setMedicalAidSchemes] = useState<MedicalAidScheme[]>([]);
  const [idValidation, setIdValidation] = useState<any>(prefilledData || null);
  
  const [data, setData] = useState<OnboardingData>({
    first_name: "",
    last_name: "",
    id_number: prefilledIdNumber || "",
    date_of_birth: prefilledData?.date_of_birth || "",
    gender: prefilledData?.gender || "",
    email: "",
    phone: "",
    alternative_phone: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    province: "",
    postal_code: "",
    emergency_contact_name: "",
    emergency_contact_relationship: "",
    emergency_contact_phone: "",
    has_medical_aid: false,
    medical_aid_scheme: "",
    medical_aid_number: "",
    medical_aid_plan: "",
    medical_aid_dependent_code: "00",
    allergies: [],
    chronic_conditions: [],
    current_medications: [],
    past_surgeries: [],
    blood_type: "unknown",
    smoking_status: "never",
    alcohol_use: "none",
    consent_telehealth: false,
    consent_data_processing: false,
    consent_marketing: false,
  });

  // Update data if prefilled props change
  useEffect(() => {
    if (prefilledIdNumber) {
      setData(prev => ({ ...prev, id_number: prefilledIdNumber }));
    }
    if (prefilledData) {
      setIdValidation(prefilledData);
      setData(prev => ({
        ...prev,
        date_of_birth: prefilledData.date_of_birth || prev.date_of_birth,
        gender: prefilledData.gender || prev.gender,
      }));
    }
  }, [prefilledIdNumber, prefilledData]);

  useEffect(() => {
    fetchMedicalAidSchemes();
  }, []);

  const fetchMedicalAidSchemes = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/patient/medical-aid-schemes`);
      const result = await response.json();
      setMedicalAidSchemes(result.schemes || []);
    } catch (error) {
      console.error("Failed to fetch schemes:", error);
    }
  };

  const validateIdNumber = async (idNumber: string) => {
    if (idNumber.length !== 13) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/patient/validate-id?id_number=${idNumber}`, {
        method: 'POST'
      });
      const result = await response.json();
      setIdValidation(result);
      
      if (result.valid) {
        setData(prev => ({
          ...prev,
          date_of_birth: result.date_of_birth,
          gender: result.gender
        }));
        toast.success("ID number validated successfully");
      } else {
        toast.error(result.error || "Invalid ID number");
      }
    } catch (error) {
      console.error("ID validation failed:", error);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Get auth token
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        toast.error("Please sign in to continue");
        return;
      }

      const payload = {
        first_name: data.first_name,
        last_name: data.last_name,
        id_number: data.id_number,
        date_of_birth: data.date_of_birth,
        gender: data.gender,
        email: data.email,
        phone: data.phone,
        alternative_phone: data.alternative_phone || null,
        address_line_1: data.address_line_1 || null,
        address_line_2: data.address_line_2 || null,
        city: data.city || null,
        province: data.province || null,
        postal_code: data.postal_code || null,
        emergency_contact: data.emergency_contact_name ? {
          name: data.emergency_contact_name,
          relationship: data.emergency_contact_relationship,
          phone: data.emergency_contact_phone
        } : null,
        has_medical_aid: data.has_medical_aid,
        medical_aid: data.has_medical_aid ? {
          scheme: data.medical_aid_scheme,
          membership_number: data.medical_aid_number,
          plan: data.medical_aid_plan || null,
          dependent_code: data.medical_aid_dependent_code
        } : null,
        medical_history: {
          allergies: data.allergies,
          chronic_conditions: data.chronic_conditions,
          current_medications: data.current_medications.map(m => ({ name: m, dosage: "", frequency: "" })),
          past_surgeries: data.past_surgeries,
          blood_type: data.blood_type
        },
        consent_telehealth: data.consent_telehealth,
        consent_data_processing: data.consent_data_processing,
        consent_marketing: data.consent_marketing
      };

      const response = await fetch(`${BACKEND_URL}/api/patient/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Onboarding failed");
      }

      toast.success("Profile completed successfully!");
      onComplete?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to complete onboarding");
    } finally {
      setLoading(false);
    }
  };

  const totalSteps = 5;
  const progress = (step / totalSteps) * 100;

  const selectedScheme = medicalAidSchemes.find(s => s.code === data.medical_aid_scheme);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Progress value={progress} className="h-2" />
        <p className="text-sm text-muted-foreground mt-2">Step {step} of {totalSteps}</p>
      </div>

      {/* Step 1: Personal Information */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Personal Information
            </CardTitle>
            <CardDescription>Tell us about yourself</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={data.first_name}
                  onChange={e => setData({...data, first_name: e.target.value})}
                  placeholder="Enter first name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={data.last_name}
                  onChange={e => setData({...data, last_name: e.target.value})}
                  placeholder="Enter last name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="id_number" className="flex items-center gap-2">
                <IdCard className="w-4 h-4" />
                South African ID Number *
              </Label>
              <div className="flex gap-2">
                <Input
                  id="id_number"
                  value={data.id_number}
                  onChange={e => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 13);
                    setData({...data, id_number: value});
                    if (value.length === 13) validateIdNumber(value);
                  }}
                  placeholder="13-digit ID number"
                  maxLength={13}
                />
                {idValidation?.valid && (
                  <Badge className="bg-success shrink-0">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </div>
              {idValidation?.valid && (
                <p className="text-xs text-muted-foreground">
                  DOB: {idValidation.date_of_birth} | Gender: {idValidation.gender} | Age: {idValidation.age}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={data.email}
                  onChange={e => setData({...data, email: e.target.value})}
                  placeholder="your@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  value={data.phone}
                  onChange={e => setData({...data, phone: e.target.value})}
                  placeholder="0XX XXX XXXX"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Address & Emergency Contact */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Address & Emergency Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Address Line 1</Label>
              <Input
                value={data.address_line_1}
                onChange={e => setData({...data, address_line_1: e.target.value})}
                placeholder="Street address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={data.city}
                  onChange={e => setData({...data, city: e.target.value})}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label>Province</Label>
                <Select value={data.province} onValueChange={v => setData({...data, province: v})}>
                  <SelectTrigger><SelectValue placeholder="Select province" /></SelectTrigger>
                  <SelectContent>
                    {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="my-4" />

            <h3 className="font-medium flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Emergency Contact
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input
                  value={data.emergency_contact_name}
                  onChange={e => setData({...data, emergency_contact_name: e.target.value})}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2">
                <Label>Relationship</Label>
                <Input
                  value={data.emergency_contact_relationship}
                  onChange={e => setData({...data, emergency_contact_relationship: e.target.value})}
                  placeholder="e.g., Spouse, Parent"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input
                value={data.emergency_contact_phone}
                onChange={e => setData({...data, emergency_contact_phone: e.target.value})}
                placeholder="0XX XXX XXXX"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Medical Aid */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Medical Aid Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="has_medical_aid"
                checked={data.has_medical_aid}
                onCheckedChange={(checked) => setData({...data, has_medical_aid: !!checked})}
              />
              <Label htmlFor="has_medical_aid">I have medical aid coverage</Label>
            </div>

            {data.has_medical_aid && (
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Medical Aid Scheme *</Label>
                  <Select value={data.medical_aid_scheme} onValueChange={v => setData({...data, medical_aid_scheme: v, medical_aid_plan: ""})}>
                    <SelectTrigger><SelectValue placeholder="Select your medical aid" /></SelectTrigger>
                    <SelectContent>
                      {medicalAidSchemes.map(s => (
                        <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedScheme && (
                  <div className="space-y-2">
                    <Label>Plan</Label>
                    <Select value={data.medical_aid_plan} onValueChange={v => setData({...data, medical_aid_plan: v})}>
                      <SelectTrigger><SelectValue placeholder="Select your plan" /></SelectTrigger>
                      <SelectContent>
                        {selectedScheme.plans.map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Membership Number *</Label>
                    <Input
                      value={data.medical_aid_number}
                      onChange={e => setData({...data, medical_aid_number: e.target.value})}
                      placeholder="Your member number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Dependent Code</Label>
                    <Input
                      value={data.medical_aid_dependent_code}
                      onChange={e => setData({...data, medical_aid_dependent_code: e.target.value})}
                      placeholder="00 for main member"
                    />
                  </div>
                </div>
              </div>
            )}

            {!data.has_medical_aid && (
              <p className="text-sm text-muted-foreground p-4 bg-muted rounded-lg">
                No problem! You can still use our services as a cash-pay patient.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Medical History */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              Medical History
            </CardTitle>
            <CardDescription>This information helps us provide better care</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                Allergies
              </Label>
              <div className="flex flex-wrap gap-2">
                {COMMON_ALLERGIES.map(allergen => (
                  <Badge
                    key={allergen}
                    variant={data.allergies.some(a => a.allergen === allergen) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      const exists = data.allergies.some(a => a.allergen === allergen);
                      if (exists) {
                        setData({...data, allergies: data.allergies.filter(a => a.allergen !== allergen)});
                      } else {
                        setData({...data, allergies: [...data.allergies, { allergen, reaction: "", severity: "mild" }]});
                      }
                    }}
                  >
                    {allergen}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Pill className="w-4 h-4" />
                Chronic Conditions
              </Label>
              <div className="flex flex-wrap gap-2">
                {COMMON_CONDITIONS.map(condition => (
                  <Badge
                    key={condition}
                    variant={data.chronic_conditions.some(c => c.condition === condition) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      const exists = data.chronic_conditions.some(c => c.condition === condition);
                      if (exists) {
                        setData({...data, chronic_conditions: data.chronic_conditions.filter(c => c.condition !== condition)});
                      } else {
                        setData({...data, chronic_conditions: [...data.chronic_conditions, { condition }]});
                      }
                    }}
                  >
                    {condition}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Blood Type</Label>
              <Select value={data.blood_type} onValueChange={v => setData({...data, blood_type: v})}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BLOOD_TYPES.map(bt => <SelectItem key={bt} value={bt}>{bt}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Smoking Status</Label>
                <Select value={data.smoking_status} onValueChange={v => setData({...data, smoking_status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never smoked</SelectItem>
                    <SelectItem value="former">Former smoker</SelectItem>
                    <SelectItem value="current">Current smoker</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Alcohol Use</Label>
                <Select value={data.alcohol_use} onValueChange={v => setData({...data, alcohol_use: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="occasional">Occasional</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="heavy">Heavy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Consent */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              Terms & Consent
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-3 p-4 bg-muted rounded-lg">
              <Checkbox
                id="consent_telehealth"
                checked={data.consent_telehealth}
                onCheckedChange={(checked) => setData({...data, consent_telehealth: !!checked})}
              />
              <div>
                <Label htmlFor="consent_telehealth" className="font-medium">Telehealth Consent *</Label>
                <p className="text-sm text-muted-foreground">
                  I consent to receive healthcare services via telehealth (video/audio consultation) and understand the limitations compared to in-person visits.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 bg-muted rounded-lg">
              <Checkbox
                id="consent_data"
                checked={data.consent_data_processing}
                onCheckedChange={(checked) => setData({...data, consent_data_processing: !!checked})}
              />
              <div>
                <Label htmlFor="consent_data" className="font-medium">Data Processing Consent (POPIA) *</Label>
                <p className="text-sm text-muted-foreground">
                  I consent to the collection, storage, and processing of my personal and health information in accordance with POPIA and the National Health Act.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 bg-muted rounded-lg">
              <Checkbox
                id="consent_marketing"
                checked={data.consent_marketing}
                onCheckedChange={(checked) => setData({...data, consent_marketing: !!checked})}
              />
              <div>
                <Label htmlFor="consent_marketing" className="font-medium">Marketing Communications (Optional)</Label>
                <p className="text-sm text-muted-foreground">
                  I would like to receive health tips, appointment reminders, and promotional offers via email/SMS.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => setStep(s => s - 1)}
          disabled={step === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {step < totalSteps ? (
          <Button onClick={() => setStep(s => s + 1)}>
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={loading || !data.consent_telehealth || !data.consent_data_processing}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              <><CheckCircle2 className="w-4 h-4 mr-2" /> Complete Registration</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
