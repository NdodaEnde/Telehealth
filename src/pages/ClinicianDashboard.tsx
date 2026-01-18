import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Clock, 
  Users, 
  Video, 
  FileText, 
  LogOut,
  Stethoscope,
  ClipboardList
} from "lucide-react";

const ClinicianDashboard = () => {
  const { profile, role, signOut } = useAuth();

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
            <Badge className={`${roleColor} text-white`}>{roleLabel}</Badge>
            <span className="text-sm text-muted-foreground">
              {profile?.first_name} {profile?.last_name}
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
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Today's Queue</p>
                  <p className="text-3xl font-bold text-foreground">0</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/10">
                  <Users className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed Today</p>
                  <p className="text-3xl font-bold text-foreground">0</p>
                </div>
                <div className="p-3 rounded-xl bg-success/10">
                  <Stethoscope className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Notes</p>
                  <p className="text-3xl font-bold text-foreground">0</p>
                </div>
                <div className="p-3 rounded-xl bg-warning/10">
                  <ClipboardList className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                  <p className="text-3xl font-bold text-foreground">0</p>
                </div>
                <div className="p-3 rounded-xl bg-secondary/20">
                  <Calendar className="w-6 h-6 text-secondary-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary">
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-3 rounded-xl bg-primary/10">
                <Video className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Start Consultation</CardTitle>
                <CardDescription>Begin a video call with patient</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary">
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

          <Card className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary">
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-3 rounded-xl bg-secondary/20">
                <Users className="w-6 h-6 text-secondary-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">Patient Queue</CardTitle>
                <CardDescription>View waiting patients</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Patient Queue */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Patient Queue
            </CardTitle>
            <CardDescription>Patients waiting for consultation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No patients in queue</p>
              <p className="text-sm mt-2">Patients will appear here when they join</p>
            </div>
          </CardContent>
        </Card>

        {/* Today's Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Today's Schedule
            </CardTitle>
            <CardDescription>Your appointments for today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No appointments scheduled for today</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ClinicianDashboard;
