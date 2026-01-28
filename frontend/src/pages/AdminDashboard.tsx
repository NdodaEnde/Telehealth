import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart3, 
  LogOut,
  RefreshCw,
  Calendar,
  Users,
  Settings,
  Building2,
  FileText,
  TrendingUp,
  Download,
  XCircle,
  CheckCircle,
  Clock,
  Loader2
} from "lucide-react";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsOverviewCards } from "@/components/analytics/AnalyticsOverviewCards";
import { AppointmentTrendsChart } from "@/components/analytics/AppointmentTrendsChart";
import { ConsultationTypesChart } from "@/components/analytics/ConsultationTypesChart";
import { StatusDistributionChart } from "@/components/analytics/StatusDistributionChart";
import { ClinicianPerformanceTable } from "@/components/analytics/ClinicianPerformanceTable";
import { PatientGrowthChart } from "@/components/analytics/PatientGrowthChart";
import { adminAnalyticsAPI } from "@/lib/api";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AdminDashboard = () => {
  const { profile, signOut } = useAuth();
  const [dateRange, setDateRange] = useState<number>(30);
  const { data, loading, error, refetch } = useAnalytics(dateRange);
  
  // Reports tab state
  const [reportPeriod, setReportPeriod] = useState<string>("month");
  const [reportData, setReportData] = useState<any>(null);
  const [peakData, setPeakData] = useState<any>(null);
  const [cancellationData, setCancellationData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // Fetch report data when period changes
  useEffect(() => {
    const fetchReportData = async () => {
      setReportLoading(true);
      try {
        const [summary, peaks, cancellations] = await Promise.all([
          adminAnalyticsAPI.getSummary(reportPeriod),
          adminAnalyticsAPI.getPeakTimes(reportPeriod),
          adminAnalyticsAPI.getCancellationStats(reportPeriod),
        ]);
        setReportData(summary);
        setPeakData(peaks);
        setCancellationData(cancellations);
      } catch (err) {
        console.error("Failed to fetch report data:", err);
      } finally {
        setReportLoading(false);
      }
    };
    
    fetchReportData();
  }, [reportPeriod]);

  const handleExportCSV = async () => {
    setExportLoading(true);
    try {
      await adminAnalyticsAPI.exportCSV(reportPeriod);
      toast.success("Report exported successfully");
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Failed to export report");
    } finally {
      setExportLoading(false);
    }
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
            <div className="hidden sm:block">
              <span className="font-bold text-lg">Quadcare Telehealth</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => refetch()} 
              disabled={loading}
              className="hidden sm:flex"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => refetch()} 
              disabled={loading}
              className="sm:hidden"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Badge className="bg-destructive text-white text-xs sm:text-sm">Admin</Badge>
            <span className="hidden md:block text-sm text-muted-foreground">
              {profile?.first_name} {profile?.last_name}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4 sm:py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              System analytics and administration
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={dateRange.toString()} onValueChange={(v) => setDateRange(parseInt(v))}>
              <SelectTrigger className="w-[140px] sm:w-[180px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="60">Last 60 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-grid sm:grid-cols-3 gap-1">
            <TabsTrigger value="analytics" className="gap-2 text-xs sm:text-sm">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden xs:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="management" className="gap-2 text-xs sm:text-sm">
              <Users className="w-4 h-4" />
              <span className="hidden xs:inline">Management</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2 text-xs sm:text-sm col-span-2 sm:col-span-1">
              <Settings className="w-4 h-4" />
              <span className="hidden xs:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {loading ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <Skeleton key={i} className="h-28" />
                  ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Skeleton className="h-80 lg:col-span-2" />
                  <Skeleton className="h-80" />
                </div>
              </div>
            ) : data ? (
              <>
                {/* Overview Stats */}
                <AnalyticsOverviewCards overview={data.overview} />

                {/* Charts Row 1 */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <AppointmentTrendsChart data={data.appointment_trends} />
                  <ConsultationTypesChart data={data.consultation_types} />
                </div>

                {/* Charts Row 2 */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <ClinicianPerformanceTable data={data.clinician_performance} />
                  <PatientGrowthChart data={data.patient_growth} />
                </div>

                {/* Status Distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <StatusDistributionChart data={data.status_distribution} />
                  
                  {/* Quick Stats Card */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        <CardTitle className="text-lg">Quick Insights</CardTitle>
                      </div>
                      <CardDescription>Key performance indicators</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm text-muted-foreground">Average Session Duration</span>
                        <span className="font-semibold">{data.overview.average_consultation_duration.toFixed(1)} min</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm text-muted-foreground">Completion Rate</span>
                        <span className="font-semibold text-success">{data.overview.completion_rate}%</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm text-muted-foreground">Appointments This Week</span>
                        <span className="font-semibold">{data.overview.appointments_this_week}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm text-muted-foreground">Prescriptions Issued</span>
                        <span className="font-semibold">{data.overview.total_prescriptions}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Failed to load analytics data</p>
                {error && <p className="text-sm mt-2 text-destructive">{error}</p>}
                <Button onClick={() => refetch()} className="mt-4">
                  Try Again
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Management Tab */}
          <TabsContent value="management" className="space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">User Management</CardTitle>
                    <CardDescription>Manage all users</CardDescription>
                  </div>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <div className="p-3 rounded-xl bg-success/10">
                    <Building2 className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Clinics</CardTitle>
                    <CardDescription>Manage clinic locations</CardDescription>
                  </div>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <div className="p-3 rounded-xl bg-warning/10">
                    <Calendar className="w-6 h-6 text-warning" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Appointments</CardTitle>
                    <CardDescription>View all bookings</CardDescription>
                  </div>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow cursor-pointer border-primary/20 hover:border-primary">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <div className="p-3 rounded-xl bg-secondary/20">
                    <FileText className="w-6 h-6 text-secondary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Reports</CardTitle>
                    <CardDescription>Generate reports</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  System Activity
                </CardTitle>
                <CardDescription>Recent system events and logs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Activity logging coming soon</p>
                  <p className="text-sm mt-2">System events will appear here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  System Settings
                </CardTitle>
                <CardDescription>Configure system parameters</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Settings panel coming soon</p>
                  <p className="text-sm mt-2">System configuration options will appear here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
