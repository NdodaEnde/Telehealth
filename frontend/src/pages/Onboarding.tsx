import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PatientOnboarding } from "@/components/onboarding/PatientOnboarding";
import { SelfieCapture } from "@/components/auth/SelfieCapture";
import { ArrowLeft, CheckCircle2, User, FileText, Heart, Loader2, Search, AlertCircle, Globe, Camera } from "lucide-react";
import { toast } from "sonner";
import { profilePhotoAPI } from "@/lib/api";

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || '';

interface EHRPatientData {
  found: boolean;
  patient_id?: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  medical_aid?: {
    scheme: string;
    membership_number: string;
    plan?: string;
  };
  allergies?: string[];
  chronic_conditions?: string[];
}

interface Country {
  code: string;
  name: string;
}

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { profile, onboardingComplete, refreshProfile, isLoading } = useAuth();
  const [step, setStep] = useState<"check" | "onboarding" | "confirm">("check");
  
  // ID Type selection
  const [idType, setIdType] = useState<"sa_id" | "passport">("sa_id");
  
  // SA ID fields
  const [idNumber, setIdNumber] = useState("");
  
  // Passport fields
  const [passportNumber, setPassportNumber] = useState("");
  const [passportCountry, setPassportCountry] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  
  const [checking, setChecking] = useState(false);
  const [ehrData, setEhrData] = useState<EHRPatientData | null>(null);
  const [idValidation, setIdValidation] = useState<any>(null);
  const [countries, setCountries] = useState<Country[]>([]);

  // Fetch countries list on mount
  useEffect(() => {
    fetchCountries();
  }, []);

  // If already onboarded, redirect to dashboard
  useEffect(() => {
    if (!isLoading && onboardingComplete) {
      navigate("/patient");
    }
  }, [isLoading, onboardingComplete, navigate]);

  const fetchCountries = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/patient/countries`);
      const data = await response.json();
      setCountries(data.countries || []);
    } catch (error) {
      console.error("Failed to fetch countries:", error);
      // Fallback list
      setCountries([
        { code: "ZW", name: "Zimbabwe" },
        { code: "MZ", name: "Mozambique" },
        { code: "MW", name: "Malawi" },
        { code: "LS", name: "Lesotho" },
        { code: "NG", name: "Nigeria" },
        { code: "OTHER", name: "Other" },
      ]);
    }
  };

  const validateAndCheckEHR = async () => {
    setChecking(true);
    try {
      let validateUrl = `${BACKEND_URL}/api/patient/validate-id?id_type=${idType}`;
      
      if (idType === "sa_id") {
        if (idNumber.length !== 13) {
          toast.error("Please enter a valid 13-digit SA ID number");
          setChecking(false);
          return;
        }
        validateUrl += `&id_number=${idNumber}`;
      } else {
        if (!passportNumber || passportNumber.length < 5) {
          toast.error("Please enter a valid passport number");
          setChecking(false);
          return;
        }
        if (!passportCountry) {
          toast.error("Please select your country of citizenship");
          setChecking(false);
          return;
        }
        if (!dateOfBirth) {
          toast.error("Please enter your date of birth");
          setChecking(false);
          return;
        }
        validateUrl += `&passport_number=${passportNumber}&country_code=${passportCountry}&date_of_birth=${dateOfBirth}`;
      }

      // Validate the ID/Passport
      const validateResponse = await fetch(validateUrl, { method: 'POST' });
      const validation = await validateResponse.json();
      
      if (!validation.valid) {
        toast.error(validation.error || "Invalid identification");
        setChecking(false);
        return;
      }
      
      setIdValidation(validation);

      // For SA ID, try to look up in HealthBridge EHR
      if (idType === "sa_id") {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.access_token) {
          try {
            const lookupResponse = await fetch(`${BACKEND_URL}/api/patient/lookup-existing?id_number=${idNumber}`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`
              }
            });
            
            if (lookupResponse.ok) {
              const ehrResult = await lookupResponse.json();
              setEhrData(ehrResult);
              
              if (ehrResult.found) {
                toast.success("We found your existing records! Please confirm your details.");
                setStep("confirm");
                return;
              }
            }
          } catch (e) {
            console.log("EHR lookup not available");
          }
        }
      }

      // No EHR record found or passport user - proceed to full onboarding
      toast.info("Please complete your profile.");
      setStep("onboarding");
    } catch (error) {
      console.error("Validation failed:", error);
      toast.error("Could not validate identification. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleOnboardingComplete = async () => {
    console.log("[Onboarding] Onboarding complete, refreshing profile...");
    await refreshProfile();
    toast.success("Profile completed successfully!");
    navigate("/patient", { replace: true, state: { justOnboarded: true } });
  };

  const handleConfirmEHRData = async () => {
    setChecking(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error("Please sign in to continue");
        return;
      }

      const payload = {
        first_name: ehrData?.first_name || profile?.first_name,
        last_name: ehrData?.last_name || profile?.last_name,
        id_type: "sa_id",
        id_number: idNumber,
        date_of_birth: ehrData?.date_of_birth || idValidation?.date_of_birth,
        gender: ehrData?.gender || idValidation?.gender,
        email: ehrData?.email || "",
        phone: ehrData?.phone || "",
        has_medical_aid: !!ehrData?.medical_aid,
        medical_aid: ehrData?.medical_aid || null,
        consent_telehealth: true,
        consent_data_processing: true,
        consent_marketing: false,
        medical_history: {
          allergies: (ehrData?.allergies || []).map(a => ({ allergen: a, reaction: "", severity: "mild" })),
          chronic_conditions: (ehrData?.chronic_conditions || []).map(c => ({ condition: c })),
          current_medications: [],
          past_surgeries: [],
          blood_type: "unknown"
        }
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
        throw new Error("Failed to save profile");
      }

      await refreshProfile();
      toast.success("Profile confirmed successfully!");
      navigate("/patient", { replace: true, state: { justOnboarded: true } });
    } catch (error) {
      console.error("Confirmation failed:", error);
      toast.error("Failed to confirm profile. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  // Show loading while checking auth state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Step 1: Check ID and look up in EHR
  if (step === "check") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card sticky top-0 z-40">
          <div className="container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm sm:text-lg">H</span>
              </div>
              <span className="font-bold text-base sm:text-lg hidden xs:block">Quadcare Telehealth</span>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-lg">
          <Card>
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-xl sm:text-2xl">Welcome, {profile?.first_name}!</CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Let's verify your identity and check for existing records.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* ID Type Selection */}
              <div className="space-y-3">
                <Label>Type of Identification</Label>
                <RadioGroup 
                  value={idType} 
                  onValueChange={(v) => setIdType(v as "sa_id" | "passport")}
                  className="grid grid-cols-2 gap-3"
                >
                  <div className="flex items-center space-x-2 p-3 rounded-lg border hover:border-primary cursor-pointer">
                    <RadioGroupItem value="sa_id" id="sa_id" />
                    <Label htmlFor="sa_id" className="flex items-center gap-2 cursor-pointer">
                      <FileText className="w-4 h-4" />
                      SA ID
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 rounded-lg border hover:border-primary cursor-pointer">
                    <RadioGroupItem value="passport" id="passport" />
                    <Label htmlFor="passport" className="flex items-center gap-2 cursor-pointer">
                      <Globe className="w-4 h-4" />
                      Passport
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* SA ID Input */}
              {idType === "sa_id" && (
                <div className="space-y-2">
                  <Label htmlFor="id_number">South African ID Number</Label>
                  <Input
                    id="id_number"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, '').slice(0, 13))}
                    placeholder="Enter your 13-digit ID number"
                    maxLength={13}
                    className="text-lg tracking-wider"
                  />
                  {idNumber.length > 0 && idNumber.length < 13 && (
                    <p className="text-xs text-muted-foreground">{13 - idNumber.length} digits remaining</p>
                  )}
                </div>
              )}

              {/* Passport Input */}
              {idType === "passport" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="passport_country">Country of Citizenship</Label>
                    <Select value={passportCountry} onValueChange={setPassportCountry}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your country" />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.filter(c => c.code !== "ZA").map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="passport_number">Passport Number</Label>
                    <Input
                      id="passport_number"
                      value={passportNumber}
                      onChange={(e) => setPassportNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      placeholder="Enter your passport number"
                      className="text-lg tracking-wider uppercase"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Date of Birth</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
              )}

              <Button 
                className="w-full" 
                size="lg" 
                onClick={validateAndCheckEHR}
                disabled={
                  checking || 
                  (idType === "sa_id" && idNumber.length !== 13) ||
                  (idType === "passport" && (!passportNumber || !passportCountry || !dateOfBirth))
                }
              >
                {checking ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</>
                ) : (
                  <><Search className="w-4 h-4 mr-2" /> Verify & Continue</>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Your information is secure and protected under POPIA.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Step 2a: Confirm EHR data (if found)
  if (step === "confirm" && ehrData?.found) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card sticky top-0 z-40">
          <div className="container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm sm:text-lg">H</span>
              </div>
              <span className="font-bold text-base sm:text-lg hidden xs:block">Quadcare Telehealth</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep("check")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-lg">
          <Card>
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <CardTitle className="text-xl sm:text-2xl">Records Found!</CardTitle>
              <CardDescription>
                We found your existing records. Please confirm your details.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="font-medium mb-3">Personal Information</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Name</p>
                      <p className="font-medium">{ehrData.first_name} {ehrData.last_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Date of Birth</p>
                      <p className="font-medium">{ehrData.date_of_birth}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Gender</p>
                      <p className="font-medium capitalize">{ehrData.gender}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Phone</p>
                      <p className="font-medium">{ehrData.phone || "Not on file"}</p>
                    </div>
                  </div>
                </div>

                {ehrData.medical_aid && (
                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="font-medium mb-3">Medical Aid</h3>
                    <div className="text-sm">
                      <p className="text-muted-foreground">Scheme</p>
                      <p className="font-medium">{ehrData.medical_aid.scheme}</p>
                      <p className="text-muted-foreground mt-2">Member Number</p>
                      <p className="font-medium">{ehrData.medical_aid.membership_number}</p>
                    </div>
                  </div>
                )}

                {(ehrData.allergies?.length || ehrData.chronic_conditions?.length) && (
                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="font-medium mb-3">Medical History</h3>
                    {ehrData.allergies && ehrData.allergies.length > 0 && (
                      <div className="mb-2">
                        <p className="text-sm text-muted-foreground">Allergies</p>
                        <p className="text-sm font-medium">{ehrData.allergies.join(", ")}</p>
                      </div>
                    )}
                    {ehrData.chronic_conditions && ehrData.chronic_conditions.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground">Chronic Conditions</p>
                        <p className="text-sm font-medium">{ehrData.chronic_conditions.join(", ")}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <Button 
                  className="w-full" 
                  size="lg" 
                  onClick={handleConfirmEHRData}
                  disabled={checking}
                >
                  {checking ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirming...</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4 mr-2" /> Confirm & Continue</>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setStep("onboarding")}
                >
                  Update My Information
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Step 2b: Full onboarding form (if not found in EHR or passport user)
  if (step === "onboarding") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card sticky top-0 z-40">
          <div className="container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm sm:text-lg">H</span>
              </div>
              <span className="font-bold text-base sm:text-lg hidden xs:block">Quadcare Telehealth</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep("check")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6 sm:py-8">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Complete Your Profile</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Help us provide better care by completing your health profile
            </p>
            {idValidation && (
              <div className="mt-3 p-3 bg-success/10 rounded-lg text-sm">
                <p className="text-success">
                  ✓ {idType === "sa_id" ? "ID" : "Passport"} Verified
                  {idValidation.date_of_birth && ` • DOB: ${idValidation.date_of_birth}`}
                  {idValidation.gender && ` • ${idValidation.gender}`}
                  {idValidation.age && ` • Age ${idValidation.age}`}
                </p>
              </div>
            )}
          </div>
          <PatientOnboarding 
            onComplete={handleOnboardingComplete} 
            prefilledIdType={idType}
            prefilledIdNumber={idType === "sa_id" ? idNumber : undefined}
            prefilledPassportNumber={idType === "passport" ? passportNumber : undefined}
            prefilledPassportCountry={idType === "passport" ? passportCountry : undefined}
            prefilledData={idValidation}
          />
        </main>
      </div>
    );
  }

  return null;
};

export default OnboardingPage;
