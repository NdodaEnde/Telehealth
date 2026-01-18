import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Pill
} from "lucide-react";
import { ClinicianStats } from "@/components/clinician/ClinicianStats";
import { PatientQueueList } from "@/components/clinician/PatientQueueList";
import { UpcomingSchedule } from "@/components/clinician/UpcomingSchedule";
import { usePatientQueue } from "@/hooks/usePatientQueue";
import { AvailabilityDialog } from "@/components/availability/AvailabilityDialog";
import { AppointmentManagerDialog } from "@/components/appointments/AppointmentManagerDialog";
import { PrescriptionList } from "@/components/prescriptions/PrescriptionList";

const ClinicianDashboard = () => {
  const navigate = useNavigate();
  const { profile, role, signOut } = useAuth();
  const { queue, stats, loading, refetch } = usePatientQueue();
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [appointmentsOpen, setAppointmentsOpen] = useState(false);
  const [showPrescriptions, setShowPrescriptions] = useState(false);

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
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">H</span>
            </div>
            <span className="font-bold text-lg">HCF Telehealth</span>
          </div>
          <div className="flex items-center gap-4">
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
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Clinician Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your patients and consultations
          </p>
        </div>

        {/* Stats Overview */}
        <div className="mb-8">
          <ClinicianStats stats={stats} pendingNotes={0} />
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-5 gap-6 mb-8">
          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary"
            onClick={() => setAppointmentsOpen(true)}
          >
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-3 rounded-xl bg-primary/10">
                <CalendarDays className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Appointments</CardTitle>
                <CardDescription>View & manage bookings</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary"
            onClick={handleStartConsultation}
          >
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-3 rounded-xl bg-primary/10">
                <Video className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Start Consultation</CardTitle>
                <CardDescription>Begin a video call</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary"
            onClick={handleClinicalNotes}
          >
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-3 rounded-xl bg-success/10">
                <FileText className="w-6 h-6 text-success" />
              </div>
              <div>
                <CardTitle className="text-lg">Clinical Notes</CardTitle>
                <CardDescription>Complete pending documentation</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card 
            className={`hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary ${showPrescriptions ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setShowPrescriptions(!showPrescriptions)}
          >
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-3 rounded-xl bg-warning/10">
                <Pill className="w-6 h-6 text-warning" />
              </div>
              <div>
                <CardTitle className="text-lg">E-Prescriptions</CardTitle>
                <CardDescription>View & create prescriptions</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary"
            onClick={() => setAvailabilityOpen(true)}
          >
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-3 rounded-xl bg-secondary/20">
                <Calendar className="w-6 h-6 text-secondary-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">Availability</CardTitle>
                <CardDescription>Manage your schedule</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Prescriptions Section (toggleable) */}
        {showPrescriptions && (
          <div className="mb-8">
            <PrescriptionList showPatient={true} />
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Patient Queue - Takes 2 columns */}
          <div className="lg:col-span-2">
            <PatientQueueList />
          </div>

          {/* Today's Schedule - Takes 1 column */}
          <div>
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
