import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  ArrowLeft, RefreshCw, Stethoscope, Users, Clock, AlertTriangle,
  ChevronRight, Menu, X, LogOut
} from "lucide-react";
import { NurseTriageForm } from "@/components/triage/NurseTriageForm";
import { format } from "date-fns";

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || '';

interface QueueItem {
  appointment: {
    id: string;
    patient_id: string;
    scheduled_at: string;
    consultation_type: string;
    status: string;
    symptoms?: string[];
  };
  patient_name: string;
  patient_profile?: {
    allergies?: any[];
    chronic_conditions?: any[];
    has_medical_aid?: boolean;
  };
  latest_symptom_assessment?: {
    urgency: string;
    urgency_score: number;
    care_pathway: string;
    assessment_summary: string;
  };
}

const URGENCY_CONFIG: Record<string, { color: string; bgColor: string }> = {
  emergency: { color: "text-red-600", bgColor: "bg-red-100" },
  urgent: { color: "text-orange-600", bgColor: "bg-orange-100" },
  soon: { color: "text-yellow-600", bgColor: "bg-yellow-100" },
  routine: { color: "text-green-600", bgColor: "bg-green-100" },
};

const NurseTriagePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, role, signOut } = useAuth();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<QueueItem | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check if we have a specific appointment to triage
  const appointmentId = searchParams.get('appointment');

  useEffect(() => {
    fetchTriageQueue();
  }, []);

  useEffect(() => {
    // If there's an appointment ID in the URL and we have the queue, select that patient
    if (appointmentId && queue.length > 0) {
      const patient = queue.find(q => q.appointment.id === appointmentId);
      if (patient) {
        setSelectedPatient(patient);
      }
    }
  }, [appointmentId, queue]);

  const fetchTriageQueue = async () => {
    setLoading(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error("Please sign in to continue");
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/triage/queue`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error("Failed to fetch triage queue");
      }

      const data = await response.json();
      setQueue(data.queue || []);
    } catch (error) {
      console.error("Error fetching triage queue:", error);
      toast.error("Failed to load triage queue");
    } finally {
      setLoading(false);
    }
  };

  const handleTriageComplete = () => {
    setSelectedPatient(null);
    fetchTriageQueue();
    toast.success("Triage completed successfully");
  };

  if (selectedPatient) {
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
            <Button variant="ghost" size="sm" onClick={() => setSelectedPatient(null)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Queue
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6 sm:py-8 max-w-4xl">
          <NurseTriageForm
            appointmentId={selectedPatient.appointment.id}
            patientId={selectedPatient.appointment.patient_id}
            patientName={selectedPatient.patient_name}
            aiAssessment={selectedPatient.latest_symptom_assessment}
            onComplete={handleTriageComplete}
          />
        </main>
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
            <span className="font-bold text-base sm:text-lg hidden xs:block">Quadcare Telehealth</span>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={fetchTriageQueue} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Badge className="bg-success text-white">Nurse</Badge>
            <span className="text-sm text-muted-foreground">
              {profile?.first_name} {profile?.last_name}
            </span>
            <Button variant="ghost" size="sm" onClick={() => navigate("/clinician")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </div>

          {/* Mobile Actions */}
          <div className="flex md:hidden items-center gap-2">
            <Button variant="ghost" size="icon" onClick={fetchTriageQueue} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
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
                {profile?.first_name} {profile?.last_name}
              </span>
              <Button variant="ghost" size="sm" onClick={() => navigate("/clinician")} className="justify-start">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <Stethoscope className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            Nurse Triage
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Assess patients before their doctor consultation
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{queue.length}</p>
                  <p className="text-xs text-muted-foreground">Waiting</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {queue.filter(q => q.latest_symptom_assessment?.urgency === 'urgent' || q.latest_symptom_assessment?.urgency === 'emergency').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Urgent</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <Stethoscope className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {queue.filter(q => q.latest_symptom_assessment).length}
                  </p>
                  <p className="text-xs text-muted-foreground">AI Assessed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Clock className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">~15</p>
                  <p className="text-xs text-muted-foreground">Min/Patient</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Queue */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Triage Queue
            </CardTitle>
            <CardDescription>Patients waiting for nurse triage assessment</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : queue.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Stethoscope className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No patients waiting for triage</p>
                <p className="text-sm">Check back soon or refresh the queue</p>
              </div>
            ) : (
              <div className="space-y-3">
                {queue.map((item) => {
                  const urgencyConfig = item.latest_symptom_assessment 
                    ? URGENCY_CONFIG[item.latest_symptom_assessment.urgency] || URGENCY_CONFIG.routine
                    : null;

                  return (
                    <div
                      key={item.appointment.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border hover:border-primary/50 transition-colors gap-3 cursor-pointer"
                      onClick={() => setSelectedPatient(item)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-primary font-medium">
                            {item.patient_name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium">{item.patient_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(item.appointment.scheduled_at), "h:mm a")} • {item.appointment.consultation_type}
                          </p>
                          {item.latest_symptom_assessment && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              AI: {item.latest_symptom_assessment.assessment_summary}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 pl-13 sm:pl-0">
                        {item.latest_symptom_assessment && urgencyConfig && (
                          <Badge className={`${urgencyConfig.bgColor} ${urgencyConfig.color}`}>
                            {item.latest_symptom_assessment.urgency} ({item.latest_symptom_assessment.urgency_score}/10)
                          </Badge>
                        )}
                        {item.patient_profile?.has_medical_aid && (
                          <Badge variant="outline" className="text-xs">Medical Aid</Badge>
                        )}
                        <Button size="sm" variant="ghost">
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default NurseTriagePage;
