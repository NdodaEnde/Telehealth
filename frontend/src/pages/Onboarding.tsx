import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PatientOnboarding } from "@/components/onboarding/PatientOnboarding";
import { ArrowLeft, CheckCircle2, User, FileText, Heart, Loader2, Search, AlertCircle } from "lucide-react";
import { toast } from "sonner";

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

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { profile, onboardingComplete, refreshProfile, isLoading } = useAuth();
  const [step, setStep] = useState<"check" | "onboarding" | "confirm">("check");
  const [idNumber, setIdNumber] = useState("");
  const [checking, setChecking] = useState(false);
  const [ehrData, setEhrData] = useState<EHRPatientData | null>(null);
  const [idValidation, setIdValidation] = useState<any>(null);

  // If already onboarded, redirect to dashboard
  useEffect(() => {
    if (!isLoading && onboardingComplete) {
      navigate("/patient");
    }
  }, [isLoading, onboardingComplete, navigate]);

  const validateAndCheckEHR = async () => {
    if (idNumber.length !== 13) {
      toast.error("Please enter a valid 13-digit SA ID number");
      return;
    }

    setChecking(true);
    try {
      // First validate the ID number
      const validateResponse = await fetch(`${BACKEND_URL}/api/patient/validate-id?id_number=${idNumber}`, {
        method: 'POST'
      });
      const validation = await validateResponse.json();
      
      if (!validation.valid) {
        toast.error(validation.error || "Invalid ID number");
        setChecking(false);
        return;
      }
      
      setIdValidation(validation);

      // Then check HealthBridge EHR for existing patient
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.access_token) {
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
          } else {
            toast.info("No existing records found. Please complete your profile.");
            setStep("onboarding");
          }
        } else {
          // EHR lookup failed, proceed with manual onboarding
          setStep("onboarding");
        }
      } else {
        setStep("onboarding");
      }
    } catch (error) {
      console.error("EHR check failed:", error);
      toast.error("Could not check existing records. Please complete your profile manually.");
      setStep("onboarding");
    } finally {
      setChecking(false);
    }
  };

  const handleOnboardingComplete = async () => {
    console.log("[Onboarding] Onboarding complete, refreshing profile...");
    await refreshProfile();
    // Give React time to update state before navigating
    setTimeout(() => {
      console.log("[Onboarding] Navigating to dashboard");
      navigate("/patient", { replace: true });
    }, 500);
  };

  const handleConfirmEHRData = async () => {
    // In a real implementation, this would save the confirmed EHR data
    // and mark onboarding as complete
    setChecking(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error("Please sign in to continue");
        return;
      }

      // Create minimal onboarding record to mark as complete
      const payload = {
        first_name: ehrData?.first_name || profile?.first_name,
        last_name: ehrData?.last_name || profile?.last_name,
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
        // Note: In real implementation, this would pull from EHR
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
      navigate("/patient");
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
              <span className="font-bold text-base sm:text-lg hidden xs:block">HCF Telehealth</span>
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
                Let's check if you have existing records with us.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                <p className="text-xs text-muted-foreground">
                  We'll use this to check for your existing medical records.
                </p>
              </div>

              {idNumber.length === 13 && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="text-muted-foreground">
                    ID entered: <span className="font-mono">{idNumber}</span>
                  </p>
                </div>
              )}

              <Button 
                className="w-full" 
                size="lg" 
                onClick={validateAndCheckEHR}
                disabled={idNumber.length !== 13 || checking}
              >
                {checking ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking records...</>
                ) : (
                  <><Search className="w-4 h-4 mr-2" /> Check My Records</>
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
              <span className="font-bold text-base sm:text-lg hidden xs:block">HCF Telehealth</span>
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

  // Step 2b: Full onboarding form (if not found in EHR)
  if (step === "onboarding") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card sticky top-0 z-40">
          <div className="container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm sm:text-lg">H</span>
              </div>
              <span className="font-bold text-base sm:text-lg hidden xs:block">HCF Telehealth</span>
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
                  ✓ ID Verified: {idValidation.date_of_birth} • {idValidation.gender} • Age {idValidation.age}
                </p>
              </div>
            )}
          </div>
          <PatientOnboarding 
            onComplete={handleOnboardingComplete} 
            prefilledIdNumber={idNumber}
            prefilledData={idValidation}
          />
        </main>
      </div>
    );
  }

  return null;
};

export default OnboardingPage;
