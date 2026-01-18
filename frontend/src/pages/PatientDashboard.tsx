import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, FileText, Video, User, LogOut, Plus, Pill, Home, Menu, X, AlertCircle } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { PatientPrescriptionHistory } from "@/components/prescriptions/PatientPrescriptionHistory";

interface Appointment {
  id: string;
  scheduled_at: string;
  consultation_type: string;
  status: string;
  clinician_name: string;
  specialization: string | null;
}

const PatientDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signOut, onboardingComplete, isLoading } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPrescriptions, setShowPrescriptions] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check if user just completed onboarding (passed via navigation state)
  const justOnboarded = location.state?.justOnboarded;

  // Auto-redirect to onboarding if not complete
  // But skip if user just completed onboarding (state might not have updated yet)
  useEffect(() => {
    if (justOnboarded) {
      console.log("[PatientDashboard] User just completed onboarding, skipping redirect check");
      return;
    }
    
    if (!isLoading && !onboardingComplete) {
      console.log("[PatientDashboard] Onboarding not complete, redirecting...");
      navigate("/onboarding");
    }
  }, [isLoading, onboardingComplete, navigate, justOnboarded]);

  useEffect(() => {
    const fetchAppointments = async () => {
      if (!user) return;

      try {
        const { data: appointmentsData, error } = await supabase
          .from("appointments")
          .select("id, scheduled_at, consultation_type, status, clinician_id")
          .eq("patient_id", user.id)
          .in("status", ["pending", "confirmed", "in_progress"])
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(5);

        if (error) throw error;

        if (appointmentsData && appointmentsData.length > 0) {
          const clinicianIds = appointmentsData.map(a => a.clinician_id);
          
          const [profilesResult, cliniciansResult] = await Promise.all([
            supabase.from("profiles").select("id, first_name, last_name").in("id", clinicianIds),
            supabase.from("clinician_profiles").select("id, specialization").in("id", clinicianIds)
          ]);

          const merged = appointmentsData.map(apt => {
            const profile = profilesResult.data?.find(p => p.id === apt.clinician_id);
            const clinician = cliniciansResult.data?.find(c => c.id === apt.clinician_id);
            return {
              id: apt.id,
              scheduled_at: apt.scheduled_at,
              consultation_type: apt.consultation_type,
              status: apt.status,
              clinician_name: profile ? `Dr. ${profile.first_name} ${profile.last_name}` : "Unknown",
              specialization: clinician?.specialization || null,
            };
          });

          setAppointments(merged);
        }
      } catch (error) {
        console.error("Error fetching appointments:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, [user]);

  // Show loading while checking onboarding status
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
          
          {/* Desktop Nav */}
          <div className="hidden sm:flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {profile?.first_name || "Patient"}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="sm:hidden p-2 hover:bg-accent rounded-lg"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-border py-3 px-4 animate-fade-in">
            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground py-2">
                Welcome, {profile?.first_name || "Patient"}
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
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Patient Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Manage your healthcare journey</p>
        </div>

        {/* Quick Actions - Responsive Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary"
            onClick={() => navigate("/book-appointment")}
          >
            <CardHeader className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 pb-2">
              <div className="p-2 sm:p-3 rounded-xl bg-primary/10">
                <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm sm:text-lg">Book</CardTitle>
                <CardDescription className="text-xs sm:text-sm hidden sm:block">Schedule appointment</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary">
            <CardHeader className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 pb-2">
              <div className="p-2 sm:p-3 rounded-xl bg-success/10">
                <Video className="w-5 h-5 sm:w-6 sm:h-6 text-success" />
              </div>
              <div>
                <CardTitle className="text-sm sm:text-lg">Video Call</CardTitle>
                <CardDescription className="text-xs sm:text-sm hidden sm:block">Join consultation</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary">
            <CardHeader className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 pb-2">
              <div className="p-2 sm:p-3 rounded-xl bg-secondary/20">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-secondary-foreground" />
              </div>
              <div>
                <CardTitle className="text-sm sm:text-lg">Records</CardTitle>
                <CardDescription className="text-xs sm:text-sm hidden sm:block">View history</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card 
            className={`hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary ${showPrescriptions ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setShowPrescriptions(!showPrescriptions)}
          >
            <CardHeader className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 pb-2">
              <div className="p-2 sm:p-3 rounded-xl bg-warning/10">
                <Pill className="w-5 h-5 sm:w-6 sm:h-6 text-warning" />
              </div>
              <div>
                <CardTitle className="text-sm sm:text-lg">Prescriptions</CardTitle>
                <CardDescription className="text-xs sm:text-sm hidden sm:block">View history</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary col-span-2 sm:col-span-1"
            onClick={() => navigate("/onboarding")}
          >
            <CardHeader className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 pb-2">
              <div className="p-2 sm:p-3 rounded-xl bg-accent/50">
                <User className="w-5 h-5 sm:w-6 sm:h-6 text-accent-foreground" />
              </div>
              <div>
                <CardTitle className="text-sm sm:text-lg">Profile</CardTitle>
                <CardDescription className="text-xs sm:text-sm hidden sm:block">Complete profile</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Prescriptions Section (toggleable) */}
        {showPrescriptions && (
          <div className="mb-6 sm:mb-8 animate-fade-in">
            <PatientPrescriptionHistory />
          </div>
        )}

        {/* Upcoming Appointments */}
        <Card className="mb-6 sm:mb-8">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Upcoming Appointments
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Your scheduled consultations</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {loading ? (
              <div className="space-y-3 sm:space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 sm:h-20 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : appointments.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <Calendar className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                <p className="text-sm sm:text-base">No upcoming appointments</p>
                <Button className="mt-4" variant="outline" size="sm" onClick={() => navigate("/book-appointment")}>
                  Book Your First Consultation
                </Button>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border border-border hover:border-primary/50 transition-colors gap-3"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm sm:text-base truncate">{apt.clinician_name}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">
                          {apt.specialization || "General Consultation"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pl-13 sm:pl-0">
                      <div className="text-left sm:text-right">
                        <p className="font-medium text-sm">
                          {format(new Date(apt.scheduled_at), "MMM d, yyyy")}
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {format(new Date(apt.scheduled_at), "h:mm a")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {apt.status === "in_progress" && (
                          <Button 
                            size="sm" 
                            onClick={() => navigate(`/consultation?appointment=${apt.id}`)}
                            className="text-xs sm:text-sm"
                          >
                            <Video className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                            Join
                          </Button>
                        )}
                        <Badge 
                          variant={apt.status === "confirmed" ? "default" : apt.status === "in_progress" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {apt.status === "in_progress" ? "Live" : apt.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Recent Activity
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Your recent healthcare interactions</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="text-center py-6 sm:py-8 text-muted-foreground">
              <FileText className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
              <p className="text-sm sm:text-base">No recent activity</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PatientDashboard;
