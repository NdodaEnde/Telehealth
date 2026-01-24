import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Video, 
  FileText, 
  LogOut,
  Calendar,
  RefreshCw,
  CalendarDays,
  Pill,
  PlayCircle,
  Menu,
  X,
  Stethoscope
} from "lucide-react";
import { ClinicianStats } from "@/components/clinician/ClinicianStats";
import { PatientQueueList } from "@/components/clinician/PatientQueueList";
import { UpcomingSchedule } from "@/components/clinician/UpcomingSchedule";
import { usePatientQueue } from "@/hooks/usePatientQueue";
import { AvailabilityDialog } from "@/components/availability/AvailabilityDialog";
import { AppointmentManagerDialog } from "@/components/appointments/AppointmentManagerDialog";
import { PrescriptionList } from "@/components/prescriptions/PrescriptionList";
import { ClinicalNotesDialog } from "@/components/clinical/ClinicalNotesDialog";
import { supabase } from "@/integrations/supabase/client";

const ClinicianDashboard = () => {
  const navigate = useNavigate();
  const { profile, role, signOut } = useAuth();
  const { queue, stats, loading, refetch } = usePatientQueue();
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [appointmentsOpen, setAppointmentsOpen] = useState(false);
  const [showPrescriptions, setShowPrescriptions] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleStartConsultation = () => {
    const inProgress = queue.find(apt => apt.status === "in_progress");
    if (inProgress) {
      navigate(`/consultation?appointment=${inProgress.id}`);
      return;
    }
    
    const confirmed = queue.find(apt => apt.status === "confirmed");
    if (confirmed) {
      toast.info("Select a patient from the queue below to start their consultation");
      return;
    }
    
    toast.info("No consultations ready. Confirm an appointment first from the queue below.");
  };

  const handleClinicalNotes = () => {
    toast.info("Select a patient from the queue below to access their clinical notes");
  };

  const roleLabel = role === "doctor" ? "Doctor" : "Nurse";
  const roleColor = role === "doctor" ? "bg-primary" : "bg-success";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm sm:text-lg">H</span>
            </div>
            <span className="font-bold text-base sm:text-lg hidden xs:block">Quadcare Telehealth</span>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={refetch} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Badge className={`${roleColor} text-white`}>{roleLabel}</Badge>
            <span className="text-sm text-muted-foreground">
              Dr. {profile?.first_name} {profile?.last_name}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>

          {/* Mobile Actions */}
          <div className="flex md:hidden items-center gap-2">
            <Button variant="ghost" size="icon" onClick={refetch} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Badge className={`${roleColor} text-white text-xs`}>{roleLabel}</Badge>
            <button 
              className="p-2 hover:bg-accent rounded-lg"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border py-3 px-4 animate-fade-in">
            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground py-2">
                Dr. {profile?.first_name} {profile?.last_name}
              </span>
              <Button variant="ghost" size="sm" onClick={signOut} className="justify-start">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Clinician Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Manage your patients and consultations
          </p>
        </div>

        {/* Stats Overview */}
        <div className="mb-6 sm:mb-8">
          <ClinicianStats stats={stats} pendingNotes={0} />
        </div>

        {/* Quick Actions - Mobile Optimized */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary"
            onClick={() => setAppointmentsOpen(true)}
          >
            <CardHeader className="p-3 sm:p-4 flex flex-col items-start gap-2 pb-2">
              <div className="p-2 sm:p-3 rounded-xl bg-primary/10">
                <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm sm:text-lg">Appointments</CardTitle>
                <CardDescription className="text-xs hidden sm:block">View & manage</CardDescription>
              </div>
            </CardHeader>
          </Card>

          {/* Nurse Triage - Show for nurses */}
          {role === "nurse" && (
            <Card 
              className="hover:shadow-lg transition-shadow cursor-pointer border-success/20 hover:border-success"
              onClick={() => navigate("/nurse-triage")}
            >
              <CardHeader className="p-3 sm:p-4 flex flex-col items-start gap-2 pb-2">
                <div className="p-2 sm:p-3 rounded-xl bg-success/10">
                  <Stethoscope className="w-5 h-5 sm:w-6 sm:h-6 text-success" />
                </div>
                <div>
                  <CardTitle className="text-sm sm:text-lg">Triage</CardTitle>
                  <CardDescription className="text-xs hidden sm:block">Assess patients</CardDescription>
                </div>
              </CardHeader>
            </Card>
          )}

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary"
            onClick={handleStartConsultation}
          >
            <CardHeader className="p-3 sm:p-4 flex flex-col items-start gap-2 pb-2">
              <div className="p-2 sm:p-3 rounded-xl bg-primary/10">
                <Video className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm sm:text-lg">Start Call</CardTitle>
                <CardDescription className="text-xs hidden sm:block">Begin video call</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary"
            onClick={handleClinicalNotes}
          >
            <CardHeader className="p-3 sm:p-4 flex flex-col items-start gap-2 pb-2">
              <div className="p-2 sm:p-3 rounded-xl bg-success/10">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-success" />
              </div>
              <div>
                <CardTitle className="text-sm sm:text-lg">Notes</CardTitle>
                <CardDescription className="text-xs hidden sm:block">Clinical notes</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer border-warning/20 hover:border-warning"
            onClick={() => navigate("/demo-consultation")}
          >
            <CardHeader className="p-3 sm:p-4 flex flex-col items-start gap-2 pb-2">
              <div className="p-2 sm:p-3 rounded-xl bg-warning/10">
                <PlayCircle className="w-5 h-5 sm:w-6 sm:h-6 text-warning" />
              </div>
              <div>
                <CardTitle className="text-sm sm:text-lg">Demo</CardTitle>
                <CardDescription className="text-xs hidden sm:block">Test video</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card 
            className={`hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary ${showPrescriptions ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setShowPrescriptions(!showPrescriptions)}
          >
            <CardHeader className="p-3 sm:p-4 flex flex-col items-start gap-2 pb-2">
              <div className="p-2 sm:p-3 rounded-xl bg-warning/10">
                <Pill className="w-5 h-5 sm:w-6 sm:h-6 text-warning" />
              </div>
              <div>
                <CardTitle className="text-sm sm:text-lg">Rx</CardTitle>
                <CardDescription className="text-xs hidden sm:block">Prescriptions</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary"
            onClick={() => setAvailabilityOpen(true)}
          >
            <CardHeader className="p-3 sm:p-4 flex flex-col items-start gap-2 pb-2">
              <div className="p-2 sm:p-3 rounded-xl bg-secondary/20">
                <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-secondary-foreground" />
              </div>
              <div>
                <CardTitle className="text-sm sm:text-lg">Availability</CardTitle>
                <CardDescription className="text-xs hidden sm:block">Set schedule</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Prescriptions Section (toggleable) */}
        {showPrescriptions && (
          <div className="mb-6 sm:mb-8 animate-fade-in">
            <PrescriptionList showPatient={true} />
          </div>
        )}

        {/* Main Content Grid - Stack on mobile */}
        <div className="grid lg:grid-cols-3 gap-4 sm:gap-8">
          {/* Patient Queue - Full width on mobile */}
          <div className="lg:col-span-2 order-1">
            <PatientQueueList />
          </div>

          {/* Today's Schedule - Full width on mobile */}
          <div className="order-2">
            <UpcomingSchedule todayAppointments={queue} />
          </div>
        </div>

        <AvailabilityDialog 
          open={availabilityOpen} 
          onOpenChange={setAvailabilityOpen} 
        />

        <AppointmentManagerDialog
          open={appointmentsOpen}
          onOpenChange={setAppointmentsOpen}
        />
      </main>
    </div>
  );
};

export default ClinicianDashboard;
