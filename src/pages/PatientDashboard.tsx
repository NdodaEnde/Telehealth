import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, FileText, Video, User, LogOut, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

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
  const { user, profile, signOut } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

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
              Welcome, {profile?.first_name || "Patient"}
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
          <h1 className="text-3xl font-bold text-foreground">Patient Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage your healthcare journey</p>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary"
            onClick={() => navigate("/book-appointment")}
          >
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-3 rounded-xl bg-primary/10">
                <Plus className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Book Consultation</CardTitle>
                <CardDescription>Schedule an appointment</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary">
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-3 rounded-xl bg-success/10">
                <Video className="w-6 h-6 text-success" />
              </div>
              <div>
                <CardTitle className="text-lg">Start Video Call</CardTitle>
                <CardDescription>Join your consultation</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary">
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-3 rounded-xl bg-secondary/20">
                <FileText className="w-6 h-6 text-secondary-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">Medical Records</CardTitle>
                <CardDescription>View your history</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary">
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-3 rounded-xl bg-accent/50">
                <User className="w-6 h-6 text-accent-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">My Profile</CardTitle>
                <CardDescription>Update your details</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Upcoming Appointments */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Upcoming Appointments
            </CardTitle>
            <CardDescription>Your scheduled consultations</CardDescription>
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
                <p>No upcoming appointments</p>
                <Button className="mt-4" variant="outline" onClick={() => navigate("/book-appointment")}>
                  Book Your First Consultation
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{apt.clinician_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {apt.specialization || "General Consultation"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {format(new Date(apt.scheduled_at), "MMM d, yyyy")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(apt.scheduled_at), "h:mm a")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {apt.status === "in_progress" && (
                        <Button 
                          size="sm" 
                          onClick={() => navigate(`/consultation?appointment=${apt.id}`)}
                        >
                          <Video className="w-4 h-4 mr-1" />
                          Join
                        </Button>
                      )}
                      <Badge variant={apt.status === "confirmed" ? "default" : apt.status === "in_progress" ? "default" : "secondary"}>
                        {apt.status === "in_progress" ? "In Progress" : apt.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Recent Activity
            </CardTitle>
            <CardDescription>Your recent healthcare interactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No recent activity</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PatientDashboard;
