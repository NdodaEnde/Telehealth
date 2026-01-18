import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AISymptomCheckerForBooking } from "@/components/booking/AISymptomCheckerForBooking";
import { ClinicianSelector } from "@/components/booking/ClinicianSelector";
import { TimeSlotSelector } from "@/components/booking/TimeSlotSelector";
import { BookingConfirmation } from "@/components/booking/BookingConfirmation";
import { WalkInBooking, EmergencyBooking } from "@/components/appointments/SpecialBookings";
import { ArrowLeft, ArrowRight, Calendar, CheckCircle, Stethoscope, User, Clock, Brain, Sparkles, AlertTriangle, Users } from "lucide-react";

type BookingStep = "intro" | "symptoms" | "clinician" | "time" | "confirm" | "walk-in" | "emergency";

type BookingType = "scheduled" | "walk-in" | "emergency";

interface SymptomData {
  symptoms: string[];
  severity: "mild" | "moderate" | "severe";
  description: string;
  recommendedSpecialization: string | null;
  aiAssessment?: {
    urgency: string;
    urgency_score: number;
    care_pathway: string;
    assessment_summary: string;
  };
}

interface ClinicianData {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  specialization: string | null;
  qualification: string | null;
  years_experience: number | null;
  bio: string | null;
}

interface TimeData {
  date: Date;
  time: string;
  consultationType: "video" | "phone" | "in_person";
}

const STEPS = [
  { id: "symptoms", label: "Symptoms", icon: Brain },
  { id: "clinician", label: "Clinician", icon: User },
  { id: "time", label: "Schedule", icon: Clock },
  { id: "confirm", label: "Confirm", icon: CheckCircle },
];

const BookAppointment = () => {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [currentStep, setCurrentStep] = useState<BookingStep>("intro");
  const [symptomData, setSymptomData] = useState<SymptomData | null>(null);
  const [clinicianData, setClinicianData] = useState<ClinicianData | null>(null);
  const [timeData, setTimeData] = useState<TimeData | null>(null);

  const getStepIndex = () => {
    const stepMap: Record<BookingStep, number> = {
      intro: -1,
      symptoms: 0,
      clinician: 1,
      time: 2,
      confirm: 3,
    };
    return stepMap[currentStep];
  };

  const handleSymptomComplete = (data: SymptomData) => {
    setSymptomData(data);
    setCurrentStep("clinician");
  };

  const handleClinicianSelect = (clinician: ClinicianData) => {
    setClinicianData(clinician);
    setCurrentStep("time");
  };

  const handleTimeSelect = (time: TimeData) => {
    setTimeData(time);
    setCurrentStep("confirm");
  };

  const handleConfirm = () => {
    navigate("/patient");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm sm:text-lg">H</span>
            </div>
            <span className="font-bold text-base sm:text-lg hidden xs:block">HCF Telehealth</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
              {profile?.first_name || "Patient"}
            </span>
            <Button variant="ghost" size="sm" onClick={() => navigate("/patient")} className="text-xs sm:text-sm">
              <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 sm:py-8 max-w-4xl">
        {/* Progress Steps */}
        {currentStep !== "intro" && (
          <div className="mb-6 sm:mb-8 overflow-x-auto">
            <div className="flex items-center justify-between min-w-[300px]">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = getStepIndex() === index;
                const isComplete = getStepIndex() > index;

                return (
                  <div key={step.id} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors ${
                          isComplete
                            ? "bg-success text-success-foreground"
                            : isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isComplete ? (
                          <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        ) : (
                          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                        )}
                      </div>
                      <span
                        className={`text-xs mt-1 sm:mt-2 ${
                          isActive ? "text-primary font-medium" : "text-muted-foreground"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div
                        className={`h-1 w-8 sm:w-16 md:w-24 mx-1 sm:mx-2 rounded ${
                          isComplete ? "bg-success" : "bg-muted"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Intro Step */}
        {currentStep === "intro" && (
          <Card className="text-center">
            <CardHeader>
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
              </div>
              <CardTitle className="text-xl sm:text-2xl">Book a Consultation</CardTitle>
              <CardDescription className="text-sm sm:text-base max-w-md mx-auto">
                Our AI-powered system will assess your symptoms and help you find the right clinician.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
                <div className="p-3 sm:p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Brain className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                  </div>
                  <h3 className="font-medium text-sm sm:text-base">AI Symptom Check</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">AI-powered assessment</p>
                </div>
                <div className="p-3 sm:p-4 bg-muted/50 rounded-lg">
                  <User className="w-6 h-6 sm:w-8 sm:h-8 text-primary mx-auto mb-2" />
                  <h3 className="font-medium text-sm sm:text-base">Choose Clinician</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">Select your preferred doctor</p>
                </div>
                <div className="p-3 sm:p-4 bg-muted/50 rounded-lg">
                  <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-primary mx-auto mb-2" />
                  <h3 className="font-medium text-sm sm:text-base">Schedule</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">Pick a convenient time</p>
                </div>
              </div>
              
              <div className="p-4 bg-primary/5 rounded-lg mb-6 text-left">
                <h4 className="font-medium flex items-center gap-2 text-sm sm:text-base">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Powered by AI
                </h4>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Our AI assistant will analyze your symptoms to determine urgency and recommend the best care pathway for you.
                </p>
              </div>

              <Button size="lg" onClick={() => setCurrentStep("symptoms")} className="w-full sm:w-auto">
                Start Booking
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* AI Symptom Checker Step */}
        {currentStep === "symptoms" && (
          <AISymptomCheckerForBooking
            onComplete={handleSymptomComplete}
            onBack={() => setCurrentStep("intro")}
          />
        )}

        {/* Clinician Selection Step */}
        {currentStep === "clinician" && symptomData && (
          <ClinicianSelector
            recommendedSpecialization={symptomData.recommendedSpecialization}
            onSelect={handleClinicianSelect}
            onBack={() => setCurrentStep("symptoms")}
          />
        )}

        {/* Time Selection Step */}
        {currentStep === "time" && clinicianData && (
          <TimeSlotSelector
            clinicianId={clinicianData.id}
            clinicianName={`${clinicianData.first_name} ${clinicianData.last_name}`}
            onSelect={handleTimeSelect}
            onBack={() => setCurrentStep("clinician")}
          />
        )}

        {/* Confirmation Step */}
        {currentStep === "confirm" && symptomData && clinicianData && timeData && (
          <BookingConfirmation
            data={{
              ...symptomData,
              clinician: clinicianData,
              ...timeData,
            }}
            onConfirm={handleConfirm}
            onBack={() => setCurrentStep("time")}
          />
        )}
      </main>
    </div>
  );
};

export default BookAppointment;
