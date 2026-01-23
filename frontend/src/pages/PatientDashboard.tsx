import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, Clock, FileText, Video, User, LogOut, 
  MessageCircle, Receipt, Menu, X, Settings 
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { PatientPrescriptionHistory } from "@/components/prescriptions/PatientPrescriptionHistory";
import { PatientChatSpace } from "@/components/chat/PatientChatSpace";
import { bookingsAPI } from "@/lib/api";

interface Appointment {
  id: string;
  scheduled_at: string;
  consultation_type: string;
  status: string;
  clinician_name: string;
  specialization: string | null;
}

interface Invoice {
  id: string;
  service_name: string;
  amount: number;
  status: string;
  consultation_date: string;
  clinician_name: string;
}

const PatientDashboardContent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signOut, onboardingComplete, isLoading } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");

  // Check if user just completed onboarding
  const justOnboarded = location.state?.justOnboarded;

  // Auto-redirect to onboarding if not complete
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

  // Function to fetch appointments
  const fetchAppointments = async () => {
    if (!user) return;

    try {
      // Fetch all recent appointments (including past for testing)
      const { data: appointmentsData, error } = await supabase
        .from("appointments")
        .select("id, scheduled_at, consultation_type, status, clinician_id")
        .eq("patient_id", user.id)
        .in("status", ["pending", "confirmed", "in_progress"])
        .order("scheduled_at", { ascending: false })
        .limit(10);

      if (!error && appointmentsData && appointmentsData.length > 0) {
        const clinicianIds = appointmentsData.map(a => a.clinician_id);
        
        const [profilesResult, cliniciansResult] = await Promise.all([
          supabase.from("profiles").select("id, first_name, last_name").in("id", clinicianIds),
          supabase.from("clinician_profiles").select("id, specialization").in("id", clinicianIds)
        ]);

        const merged = appointmentsData.map(apt => {
          const profileData = profilesResult.data?.find(p => p.id === apt.clinician_id);
          const clinician = cliniciansResult.data?.find(c => c.id === apt.clinician_id);
          return {
            id: apt.id,
            scheduled_at: apt.scheduled_at,
            consultation_type: apt.consultation_type,
            status: apt.status,
            clinician_name: profileData ? `${profileData.first_name} ${profileData.last_name}` : "Unknown",
            specialization: clinician?.specialization || null,
          };
        });

        setAppointments(merged);
      } else {
        setAppointments([]);
      }
    } catch (error) {
      console.error("Error fetching appointments:", error);
    }
  };

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        await fetchAppointments();

        // Fetch invoices
        try {
          const invoicesData = await bookingsAPI.getMyInvoices();
          setInvoices(invoicesData || []);
        } catch (e) {
          console.log("No invoices or error fetching:", e);
        }

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Real-time subscription for appointment status changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('patient-appointments')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
          filter: `patient_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[PatientDashboard] Appointment updated:', payload);
          // Update the appointment in state
          setAppointments(prev => prev.map(apt => 
            apt.id === payload.new.id 
              ? { ...apt, status: payload.new.status }
              : apt
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      <main className="container mx-auto px-4 py-4 sm:py-6">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Patient Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Manage your healthcare journey</p>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="consultations" className="flex items-center gap-2">
              <Video className="w-4 h-4" />
              <span className="hidden sm:inline">Consultations</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
          </TabsList>

          {/* Chat Tab */}
          <TabsContent value="chat" className="min-h-[600px]">
            <PatientChatSpace />
          </TabsContent>

          {/* Consultations Tab */}
          <TabsContent value="consultations" className="space-y-6">
            {/* Upcoming Appointments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Upcoming Consultations
                </CardTitle>
                <CardDescription>Your scheduled video consultations</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : appointments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No upcoming consultations</p>
                    <p className="text-sm mt-2">Start a chat to book your first consultation</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {appointments.map((apt) => {
                      const scheduledTime = new Date(apt.scheduled_at);
                      const now = new Date();
                      const minutesUntil = (scheduledTime.getTime() - now.getTime()) / (1000 * 60);
                      // Can join 15 minutes before scheduled time or if in_progress
                      const canJoin = apt.status === "in_progress" || 
                        (apt.status === "confirmed" && minutesUntil <= 15 && minutesUntil >= -60);
                      
                      return (
                        <div
                          key={apt.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border hover:border-primary/50 transition-colors gap-3"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Calendar className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{apt.clinician_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {apt.specialization || "General Consultation"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-4 pl-16 sm:pl-0">
                            <div className="text-left sm:text-right">
                              <p className="font-medium">
                                {format(new Date(apt.scheduled_at), "MMM d, yyyy")}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(apt.scheduled_at), "h:mm a")}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {canJoin && (
                                <Button 
                                  size="sm" 
                                  onClick={() => navigate(`/consultation?appointment=${apt.id}`)}
                                  className={apt.status === "in_progress" ? "animate-pulse" : ""}
                                >
                                  <Video className="w-4 h-4 mr-1" />
                                  {apt.status === "in_progress" ? "Join Now" : "Join"}
                                </Button>
                              )}
                              <Badge 
                                variant={apt.status === "confirmed" ? "default" : apt.status === "in_progress" ? "destructive" : "secondary"}
                              >
                                {apt.status === "in_progress" ? "🔴 Live" : apt.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Prescriptions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Prescriptions
                </CardTitle>
                <CardDescription>Your prescription history</CardDescription>
              </CardHeader>
              <CardContent>
                <PatientPrescriptionHistory />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            {/* Personal Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Personal Information
                </CardTitle>
                <CardDescription>Your profile details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Full Name</label>
                    <p className="font-medium">{profile?.first_name} {profile?.last_name}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Phone</label>
                    <p className="font-medium">{profile?.phone || "Not provided"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Email</label>
                    <p className="font-medium">{user?.email}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">ID Number</label>
                    <p className="font-medium">{profile?.id_number || "Not provided"}</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => navigate("/onboarding")}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Update Profile
                </Button>
              </CardContent>
            </Card>

            {/* Invoices */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary" />
                  Invoices
                </CardTitle>
                <CardDescription>Your billing history</CardDescription>
              </CardHeader>
              <CardContent>
                {invoices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No invoices yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {invoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border"
                      >
                        <div>
                          <p className="font-medium">{invoice.service_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(invoice.consultation_date), "MMM d, yyyy")} • {invoice.clinician_name}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-medium">R {invoice.amount.toFixed(2)}</p>
                            <Badge variant={invoice.status === "paid" ? "default" : "secondary"}>
                              {invoice.status}
                            </Badge>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(`/api/bookings/invoices/${invoice.id}/pdf`, '_blank')}
                          >
                            PDF
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

// Wrap with ChatProvider
const PatientDashboard = () => {
  return (
    <ChatProvider>
      <PatientDashboardContent />
    </ChatProvider>
  );
};

export default PatientDashboard;
