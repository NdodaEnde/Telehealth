import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SymptomChecker } from "@/components/booking/SymptomChecker";
import { ClinicianSelector } from "@/components/booking/ClinicianSelector";
import { TimeSlotSelector } from "@/components/booking/TimeSlotSelector";
import { BookingConfirmation } from "@/components/booking/BookingConfirmation";
import { ArrowLeft, ArrowRight, Calendar, CheckCircle, Stethoscope, User, Clock } from "lucide-react";

type BookingStep = "intro" | "symptoms" | "clinician" | "time" | "confirm";

interface SymptomData {
  symptoms: string[];
  severity: "mild" | "moderate" | "severe";
  description: string;
  recommendedSpecialization: string | null;
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
  { id: "symptoms", label: "Symptoms", icon: Stethoscope },
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
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">H</span>
            </div>
            <span className="font-bold text-lg">HCF Telehealth</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {profile?.first_name || "Patient"}
            </span>
            <Button variant="ghost" size="sm" onClick={() => navigate("/patient")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Progress Steps */}
        {currentStep !== "intro" && (
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = getStepIndex() === index;
                const isComplete = getStepIndex() > index;

                return (
                  <div key={step.id} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                          isComplete
                            ? "bg-success text-success-foreground"
                            : isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isComplete ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <Icon className="w-5 h-5" />
                        )}
                      </div>
                      <span
                        className={`text-xs mt-2 ${
                          isActive ? "text-primary font-medium" : "text-muted-foreground"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div
                        className={`h-1 w-16 md:w-24 mx-2 rounded ${
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
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-10 h-10 text-primary" />
              </div>
              <CardTitle className="text-2xl">Book a Consultation</CardTitle>
              <CardDescription className="text-base max-w-md mx-auto">
                Tell us about your symptoms and we'll help you find the right clinician and schedule an appointment.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 mb-8">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <Stethoscope className="w-8 h-8 text-primary mx-auto mb-2" />
                  <h3 className="font-medium">Symptom Check</h3>
                  <p className="text-sm text-muted-foreground">Tell us what you're experiencing</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <User className="w-8 h-8 text-primary mx-auto mb-2" />
                  <h3 className="font-medium">Choose Clinician</h3>
                  <p className="text-sm text-muted-foreground">Select your preferred doctor</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <Clock className="w-8 h-8 text-primary mx-auto mb-2" />
                  <h3 className="font-medium">Schedule</h3>
                  <p className="text-sm text-muted-foreground">Pick a convenient time</p>
                </div>
              </div>
              <Button size="lg" onClick={() => setCurrentStep("symptoms")}>
                Start Booking
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Symptom Checker Step */}
        {currentStep === "symptoms" && (
          <SymptomChecker
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
