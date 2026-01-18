import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PatientOnboarding } from "@/components/onboarding/PatientOnboarding";
import { ArrowLeft, CheckCircle2, User, FileText, Heart } from "lucide-react";

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  const handleComplete = () => {
    navigate("/patient");
  };

  if (showOnboarding) {
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
            <Button variant="ghost" size="sm" onClick={() => setShowOnboarding(false)}>
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
          </div>
          <PatientOnboarding onComplete={handleComplete} />
        </main>
      </div>
    );
  }

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
          <Button variant="ghost" size="sm" onClick={() => navigate("/patient")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Skip for now
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="text-center">
          <CardHeader>
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
            </div>
            <CardTitle className="text-xl sm:text-2xl">Welcome, {profile?.first_name}!</CardTitle>
            <CardDescription className="text-sm sm:text-base max-w-md mx-auto">
              Complete your health profile to get the most out of your telehealth experience.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 text-left">
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <div className="p-2 rounded-full bg-primary/10">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">Personal Information</h3>
                  <p className="text-sm text-muted-foreground">
                    ID verification and contact details
                  </p>
                </div>
                <CheckCircle2 className="w-5 h-5 text-muted-foreground/30 ml-auto" />
              </div>
              
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <div className="p-2 rounded-full bg-success/10">
                  <Heart className="w-5 h-5 text-success" />
                </div>
                <div>
                  <h3 className="font-medium">Medical History</h3>
                  <p className="text-sm text-muted-foreground">
                    Allergies, chronic conditions, medications
                  </p>
                </div>
                <CheckCircle2 className="w-5 h-5 text-muted-foreground/30 ml-auto" />
              </div>
              
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <div className="p-2 rounded-full bg-warning/10">
                  <svg className="w-5 h-5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium">Medical Aid Details</h3>
                  <p className="text-sm text-muted-foreground">
                    Insurance information for billing
                  </p>
                </div>
                <CheckCircle2 className="w-5 h-5 text-muted-foreground/30 ml-auto" />
              </div>
            </div>

            <div className="pt-4">
              <Button size="lg" className="w-full sm:w-auto" onClick={() => setShowOnboarding(true)}>
                Complete Profile
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                Takes about 5 minutes • You can save and continue later
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default OnboardingPage;
