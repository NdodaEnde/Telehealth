import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Loader2,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  UserPlus
} from "lucide-react";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsOverviewCards } from "@/components/analytics/AnalyticsOverviewCards";
import { AppointmentTrendsChart } from "@/components/analytics/AppointmentTrendsChart";
import { ConsultationTypesChart } from "@/components/analytics/ConsultationTypesChart";
import { StatusDistributionChart } from "@/components/analytics/StatusDistributionChart";
import { ClinicianPerformanceTable } from "@/components/analytics/ClinicianPerformanceTable";
import { PatientGrowthChart } from "@/components/analytics/PatientGrowthChart";
import { adminAnalyticsAPI, bulkImportAPI } from "@/lib/api";
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
  const [funnelData, setFunnelData] = useState<any>(null);
  const [noShowData, setNoShowData] = useState<any>(null);
  const [workloadData, setWorkloadData] = useState<any>(null);
  const [timestampTrends, setTimestampTrends] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // Bulk Import state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState("");
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [corporateClients, setCorporateClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState("Campus Africa");
  const [selectedClientType, setSelectedClientType] = useState("university");
  const [newClientName, setNewClientName] = useState("");

  // Fetch corporate clients on mount
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await bulkImportAPI.getCorporateClients();
        if (response?.clients) {
          setCorporateClients(response.clients);
        }
      } catch (err) {
        console.error("Failed to fetch corporate clients:", err);
      }
    };
    fetchClients();
  }, []);

  // Fetch report data when period changes
  useEffect(() => {
    const fetchReportData = async () => {
      setReportLoading(true);
      try {
        const [summary, peaks, cancellations, funnel, noShows, workload, trends] = await Promise.all([
          adminAnalyticsAPI.getSummary(reportPeriod),
          adminAnalyticsAPI.getPeakTimes(reportPeriod),
          adminAnalyticsAPI.getCancellationStats(reportPeriod),
          adminAnalyticsAPI.getConversionFunnel(reportPeriod),
          adminAnalyticsAPI.getNoShowRates(reportPeriod),
          adminAnalyticsAPI.getReceptionistWorkload(reportPeriod),
          adminAnalyticsAPI.getTimestampTrends(reportPeriod),
        ]);
        setReportData(summary);
        setPeakData(peaks);
        setCancellationData(cancellations);
        setFunnelData(funnel);
        setNoShowData(noShows);
        setWorkloadData(workload);
        setTimestampTrends(trends);
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

  // Bulk Import handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportPreview(null);
      setImportResult(null);
      setImportStep('upload');
    }
  };

  const handlePreview = async () => {
    if (!importFile) return;
    
    setImportLoading(true);
    try {
      const preview = await bulkImportAPI.preview(importFile, importPassword || undefined);
      setImportPreview(preview);
      setImportStep('preview');
      toast.success(`File parsed successfully. ${preview.total_rows} rows found.`);
    } catch (err: any) {
      console.error("Preview failed:", err);
      if (err.message?.includes('password protected')) {
        toast.error("File is password protected. Please enter the password.");
      } else if (err.message?.includes('Invalid password')) {
        toast.error("Invalid password. Please try again.");
      } else {
        toast.error(err.message || "Failed to preview file");
      }
    } finally {
      setImportLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    
    setImportLoading(true);
    setImportStep('importing');
    try {
      const result = await bulkImportAPI.importStudents(importFile, importPassword || undefined);
      setImportResult(result);
      setImportStep('complete');
      toast.success(`Import complete! ${result.summary.imported} students imported.`);
    } catch (err: any) {
      console.error("Import failed:", err);
      toast.error(err.message || "Import failed");
      setImportStep('preview');
    } finally {
      setImportLoading(false);
    }
  };

  const resetImport = () => {
    setImportFile(null);
    setImportPassword("");
    setImportPreview(null);
    setImportResult(null);
    setImportStep('upload');
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
          <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-grid sm:grid-cols-4 gap-1">
            <TabsTrigger value="analytics" className="gap-2 text-xs sm:text-sm">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden xs:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2 text-xs sm:text-sm">
              <FileText className="w-4 h-4" />
              <span className="hidden xs:inline">Reports</span>
            </TabsTrigger>
            <TabsTrigger value="management" className="gap-2 text-xs sm:text-sm">
              <Users className="w-4 h-4" />
              <span className="hidden xs:inline">Management</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2 text-xs sm:text-sm">
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

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            {/* Report Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Booking Reports</h2>
                <p className="text-sm text-muted-foreground">Detailed analytics and export options</p>
              </div>
              <div className="flex items-center gap-3">
                <Select value={reportPeriod} onValueChange={setReportPeriod}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Last 7 days</SelectItem>
                    <SelectItem value="month">Last 30 days</SelectItem>
                    <SelectItem value="quarter">Last 90 days</SelectItem>
                    <SelectItem value="year">Last year</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  onClick={handleExportCSV}
                  disabled={exportLoading}
                >
                  {exportLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Export CSV
                </Button>
              </div>
            </div>

            {reportLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            ) : reportData ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Bookings</CardDescription>
                      <CardTitle className="text-3xl">{reportData.booking_stats.total_bookings}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        {reportData.booking_stats.period_start} - {reportData.booking_stats.period_end}
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        Completed
                      </CardDescription>
                      <CardTitle className="text-3xl text-green-600">{reportData.booking_stats.completed}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        {reportData.booking_stats.total_bookings > 0 
                          ? Math.round((reportData.booking_stats.completed / reportData.booking_stats.total_bookings) * 100)
                          : 0}% completion rate
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-red-500" />
                        Cancelled
                      </CardDescription>
                      <CardTitle className="text-3xl text-red-600">{reportData.booking_stats.cancelled}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        {cancellationData?.cancellation_rate || 0}% cancellation rate
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-yellow-500" />
                        Pending
                      </CardDescription>
                      <CardTitle className="text-3xl text-yellow-600">
                        {reportData.booking_stats.pending + reportData.booking_stats.confirmed}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Awaiting consultation
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Peak Times & Service Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Peak Times */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        Peak Times Analysis
                      </CardTitle>
                      <CardDescription>When are consultations most requested?</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {peakData?.insights ? (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                              <p className="text-xs text-muted-foreground">Busiest Day</p>
                              <p className="font-semibold text-green-700 dark:text-green-300">
                                {peakData.insights.peak_day.day}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {peakData.insights.peak_day.bookings} bookings
                              </p>
                            </div>
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                              <p className="text-xs text-muted-foreground">Peak Hour</p>
                              <p className="font-semibold text-blue-700 dark:text-blue-300">
                                {peakData.insights.peak_hour.time}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {peakData.insights.peak_hour.bookings} bookings
                              </p>
                            </div>
                            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                              <p className="text-xs text-muted-foreground">Quietest Day</p>
                              <p className="font-semibold text-orange-700 dark:text-orange-300">
                                {peakData.insights.offpeak_day.day}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {peakData.insights.offpeak_day.bookings} bookings
                              </p>
                            </div>
                            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                              <p className="text-xs text-muted-foreground">Off-Peak Hour</p>
                              <p className="font-semibold text-purple-700 dark:text-purple-300">
                                {peakData.insights.offpeak_hour.time}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {peakData.insights.offpeak_hour.bookings} bookings
                              </p>
                            </div>
                          </div>
                          
                          {/* Day of Week Distribution */}
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Bookings by Day of Week</p>
                            {peakData.by_day_of_week?.map((day: any) => (
                              <div key={day.day} className="flex items-center gap-2">
                                <span className="w-20 text-xs text-muted-foreground">{day.day}</span>
                                <div className="flex-1 bg-muted rounded-full h-2">
                                  <div 
                                    className="bg-primary rounded-full h-2" 
                                    style={{ 
                                      width: `${peakData.insights.peak_day.bookings > 0 
                                        ? (day.count / peakData.insights.peak_day.bookings) * 100 
                                        : 0}%` 
                                    }}
                                  />
                                </div>
                                <span className="w-8 text-xs text-right">{day.count}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-muted-foreground text-center py-4">No data available</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Service Type Breakdown */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        Service Type Breakdown
                      </CardTitle>
                      <CardDescription>Distribution of consultation types</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {reportData.service_breakdown?.length > 0 ? (
                        reportData.service_breakdown.map((service: any) => (
                          <div key={service.service_type} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span>{service.service_type}</span>
                              <span className="font-medium">{service.count} ({service.percentage}%)</span>
                            </div>
                            <div className="bg-muted rounded-full h-2">
                              <div 
                                className="bg-primary rounded-full h-2 transition-all" 
                                style={{ width: `${service.percentage}%` }}
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-center py-4">No data available</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Timestamp Trends - Detailed Analysis */}
                {timestampTrends && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary" />
                        Consultation Time Trends
                      </CardTitle>
                      <CardDescription>
                        When do students book consultations? Busiest time: {timestampTrends.summary?.busiest_time_slot?.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Summary Cards */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                          <p className="text-2xl font-bold text-blue-600">{timestampTrends.summary?.peak_hour?.time}</p>
                          <p className="text-xs text-muted-foreground">Peak Hour</p>
                          <p className="text-sm text-blue-600">{timestampTrends.summary?.peak_hour?.count} bookings</p>
                        </div>
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                          <p className="text-2xl font-bold text-green-600">{timestampTrends.summary?.peak_day?.day}</p>
                          <p className="text-xs text-muted-foreground">Busiest Day</p>
                          <p className="text-sm text-green-600">{timestampTrends.summary?.peak_day?.count} bookings</p>
                        </div>
                        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center">
                          <p className="text-2xl font-bold text-purple-600">{timestampTrends.summary?.total_appointments}</p>
                          <p className="text-xs text-muted-foreground">Total Consultations</p>
                          <p className="text-sm text-purple-600">in selected period</p>
                        </div>
                      </div>

                      {/* Hourly Distribution Chart */}
                      <div>
                        <h4 className="text-sm font-medium mb-3">Hourly Distribution (SAST)</h4>
                        <div className="flex items-end gap-1 h-32">
                          {timestampTrends.hourly_distribution?.map((hour: any) => {
                            const height = timestampTrends.scaling?.max_hourly > 0 
                              ? (hour.count / timestampTrends.scaling.max_hourly) * 100 
                              : 0;
                            return (
                              <div key={hour.hour} className="flex-1 flex flex-col items-center group">
                                <div 
                                  className={`w-full rounded-t transition-all ${
                                    hour.is_peak ? 'bg-primary' : 'bg-primary/40'
                                  } hover:bg-primary/80`}
                                  style={{ height: `${Math.max(height, 2)}%` }}
                                  title={`${hour.hour}: ${hour.count} bookings`}
                                />
                                <span className="text-[10px] text-muted-foreground mt-1 hidden sm:block">
                                  {hour.hour_numeric % 3 === 0 ? hour.hour.slice(0, 2) : ''}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>00:00</span>
                          <span>06:00</span>
                          <span>12:00</span>
                          <span>18:00</span>
                          <span>23:00</span>
                        </div>
                      </div>

                      {/* Day of Week Distribution */}
                      <div>
                        <h4 className="text-sm font-medium mb-3">Day of Week Distribution</h4>
                        <div className="grid grid-cols-7 gap-2">
                          {timestampTrends.daily_distribution?.map((day: any) => {
                            const intensity = timestampTrends.scaling?.max_daily > 0 
                              ? (day.count / timestampTrends.scaling.max_daily) 
                              : 0;
                            return (
                              <div key={day.day} className="text-center">
                                <div 
                                  className={`h-16 rounded-lg flex items-center justify-center text-sm font-medium ${
                                    day.is_peak 
                                      ? 'bg-primary text-primary-foreground' 
                                      : 'bg-primary/20'
                                  }`}
                                  style={{ 
                                    opacity: Math.max(intensity, 0.2)
                                  }}
                                >
                                  {day.count}
                                </div>
                                <span className="text-xs text-muted-foreground mt-1">{day.day_short}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Heatmap - Day x Hour */}
                      <div>
                        <h4 className="text-sm font-medium mb-3">Weekly Heatmap (Day × Hour)</h4>
                        <div className="overflow-x-auto">
                          <div className="min-w-[600px]">
                            {/* Hour headers */}
                            <div className="flex mb-1">
                              <div className="w-16" />
                              {[0, 3, 6, 9, 12, 15, 18, 21].map(h => (
                                <div key={h} className="flex-1 text-center text-xs text-muted-foreground">
                                  {`${h}:00`}
                                </div>
                              ))}
                            </div>
                            {/* Heatmap rows */}
                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, dayIndex) => (
                              <div key={day} className="flex items-center mb-1">
                                <div className="w-16 text-xs text-muted-foreground pr-2 text-right">{day.slice(0, 3)}</div>
                                <div className="flex-1 flex gap-[1px]">
                                  {Array.from({ length: 24 }, (_, hour) => {
                                    const cellData = timestampTrends.heatmap?.data?.find(
                                      (d: any) => d.day_index === dayIndex && d.hour_index === hour
                                    );
                                    const count = cellData?.count || 0;
                                    const intensity = timestampTrends.scaling?.max_heatmap > 0 
                                      ? count / timestampTrends.scaling.max_heatmap 
                                      : 0;
                                    return (
                                      <div
                                        key={hour}
                                        className="flex-1 h-6 rounded-sm transition-colors cursor-pointer hover:ring-1 hover:ring-primary"
                                        style={{
                                          backgroundColor: count > 0 
                                            ? `rgba(59, 130, 246, ${Math.max(intensity, 0.1)})` 
                                            : 'rgba(0,0,0,0.05)'
                                        }}
                                        title={`${day} ${hour}:00 - ${count} bookings`}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                            {/* Legend */}
                            <div className="flex items-center justify-end gap-2 mt-2">
                              <span className="text-xs text-muted-foreground">Less</span>
                              <div className="flex gap-[1px]">
                                {[0.1, 0.3, 0.5, 0.7, 1].map((opacity, i) => (
                                  <div 
                                    key={i}
                                    className="w-4 h-4 rounded-sm"
                                    style={{ backgroundColor: `rgba(59, 130, 246, ${opacity})` }}
                                  />
                                ))}
                              </div>
                              <span className="text-xs text-muted-foreground">More</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Daily Trend Line */}
                      {timestampTrends.daily_trend?.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-3">Daily Booking Trend</h4>
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {timestampTrends.daily_trend.map((day: any) => (
                              <div key={day.date} className="flex items-center gap-2 text-sm">
                                <span className="w-24 text-muted-foreground">{day.date}</span>
                                <div className="flex-1 flex items-center gap-1">
                                  <div 
                                    className="bg-primary h-4 rounded"
                                    style={{ 
                                      width: `${Math.max(
                                        (day.total / Math.max(...timestampTrends.daily_trend.map((d: any) => d.total || 1))) * 100, 
                                        5
                                      )}%` 
                                    }}
                                  />
                                </div>
                                <span className="w-20 text-right">
                                  <span className="font-medium">{day.total}</span>
                                  {day.completed > 0 && (
                                    <span className="text-green-600 text-xs ml-1">({day.completed}✓)</span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Top Clinicians */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      Clinician Performance
                    </CardTitle>
                    <CardDescription>Top clinicians by appointment volume</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {reportData.top_clinicians?.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 font-medium">Clinician</th>
                              <th className="text-center py-2 font-medium">Total</th>
                              <th className="text-center py-2 font-medium">Completed</th>
                              <th className="text-center py-2 font-medium">Cancelled</th>
                              <th className="text-right py-2 font-medium">Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.top_clinicians.map((clinician: any) => (
                              <tr key={clinician.clinician_name} className="border-b last:border-0">
                                <td className="py-2">{clinician.clinician_name}</td>
                                <td className="text-center py-2">{clinician.total_appointments}</td>
                                <td className="text-center py-2 text-green-600">{clinician.completed}</td>
                                <td className="text-center py-2 text-red-600">{clinician.cancelled}</td>
                                <td className="text-right py-2">
                                  {clinician.total_appointments > 0 
                                    ? Math.round((clinician.completed / clinician.total_appointments) * 100)
                                    : 0}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No data available</p>
                    )}
                  </CardContent>
                </Card>

                {/* Conversion Funnel */}
                {funnelData && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        Conversion Funnel
                      </CardTitle>
                      <CardDescription>Patient journey from chat to completed consultation</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Funnel Visualization */}
                        <div className="space-y-2">
                          {[
                            { label: "Chats Initiated", value: funnelData.funnel.chats_initiated, color: "bg-blue-500" },
                            { label: "Bookings Created", value: funnelData.funnel.bookings_created, color: "bg-indigo-500" },
                            { label: "Consultations Confirmed", value: funnelData.funnel.consultations_confirmed, color: "bg-purple-500" },
                            { label: "Consultations Completed", value: funnelData.funnel.consultations_completed, color: "bg-green-500" },
                          ].map((stage, idx) => {
                            const maxValue = funnelData.funnel.chats_initiated || 1;
                            const width = Math.max((stage.value / maxValue) * 100, 5);
                            return (
                              <div key={stage.label} className="flex items-center gap-3">
                                <div className="w-40 text-sm text-right">{stage.label}</div>
                                <div className="flex-1 bg-muted rounded-full h-8 overflow-hidden">
                                  <div 
                                    className={`${stage.color} h-full flex items-center justify-end pr-3 transition-all`}
                                    style={{ width: `${width}%` }}
                                  >
                                    <span className="text-white text-sm font-medium">{stage.value}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Conversion Rates */}
                        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-primary">{funnelData.conversion_rates.chat_to_booking}%</p>
                            <p className="text-xs text-muted-foreground">Chat → Booking</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">{funnelData.conversion_rates.booking_to_completed}%</p>
                            <p className="text-xs text-muted-foreground">Booking → Completed</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-purple-600">{funnelData.conversion_rates.overall}%</p>
                            <p className="text-xs text-muted-foreground">Overall Conversion</p>
                          </div>
                        </div>
                        
                        {/* Abandonment */}
                        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-orange-700 dark:text-orange-300">
                              Chats without booking (Abandonment)
                            </span>
                            <span className="font-semibold text-orange-700 dark:text-orange-300">
                              {funnelData.abandonment.chats_without_booking} ({funnelData.abandonment.abandonment_rate}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* No-Show Rates & Receptionist Workload */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* No-Show Rates */}
                  {noShowData && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <XCircle className="w-5 h-5 text-red-500" />
                          No-Show Analysis
                        </CardTitle>
                        <CardDescription>Appointments missed without cancellation</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-muted rounded-lg text-center">
                            <p className="text-3xl font-bold text-red-600">{noShowData.summary.no_shows}</p>
                            <p className="text-sm text-muted-foreground">No-Shows</p>
                          </div>
                          <div className="p-4 bg-muted rounded-lg text-center">
                            <p className="text-3xl font-bold text-red-600">{noShowData.summary.no_show_rate}%</p>
                            <p className="text-sm text-muted-foreground">No-Show Rate</p>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <p className="text-sm font-medium">No-Shows by Day</p>
                          {noShowData.by_day_of_week?.map((day: any) => (
                            <div key={day.day} className="flex items-center gap-2">
                              <span className="w-20 text-xs text-muted-foreground">{day.day}</span>
                              <div className="flex-1 bg-muted rounded-full h-2">
                                <div 
                                  className="bg-red-500 rounded-full h-2" 
                                  style={{ 
                                    width: `${noShowData.summary.no_shows > 0 
                                      ? (day.no_shows / noShowData.summary.no_shows) * 100 
                                      : 0}%` 
                                  }}
                                />
                              </div>
                              <span className="w-8 text-xs text-right">{day.no_shows}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Receptionist Workload */}
                  {workloadData && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="w-5 h-5 text-primary" />
                          Receptionist Workload
                        </CardTitle>
                        <CardDescription>Chat and booking distribution</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-primary/5 rounded-lg text-center">
                            <p className="text-2xl font-bold">{workloadData.summary.total_chats_handled}</p>
                            <p className="text-xs text-muted-foreground">Total Chats</p>
                          </div>
                          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                            <p className="text-2xl font-bold text-green-600">{workloadData.summary.total_bookings_created}</p>
                            <p className="text-xs text-muted-foreground">Bookings Created</p>
                          </div>
                        </div>
                        
                        {workloadData.by_receptionist?.length > 0 ? (
                          <div className="space-y-3">
                            <p className="text-sm font-medium">By Receptionist</p>
                            {workloadData.by_receptionist.map((rec: any) => (
                              <div key={rec.receptionist_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted">
                                <div>
                                  <p className="font-medium text-sm">{rec.receptionist_name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {rec.chats_handled} chats • {rec.bookings_created} bookings
                                  </p>
                                </div>
                                <Badge variant={rec.conversion_rate >= 50 ? "default" : "secondary"}>
                                  {rec.conversion_rate}% conversion
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-center py-4">No receptionist data available</p>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No report data available</p>
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

              {/* Bulk Import Card */}
              <Dialog open={showImportDialog} onOpenChange={(open) => {
                setShowImportDialog(open);
                if (!open) resetImport();
              }}>
                <DialogTrigger asChild>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer border-green-500/20 hover:border-green-500 bg-green-50/50 dark:bg-green-900/10">
                    <CardHeader className="flex flex-row items-center gap-4 pb-2">
                      <div className="p-3 rounded-xl bg-green-500/10">
                        <Upload className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Bulk Import</CardTitle>
                        <CardDescription>Import students from Excel</CardDescription>
                      </div>
                    </CardHeader>
                  </Card>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5" />
                      Campus Africa Student Import
                    </DialogTitle>
                    <DialogDescription>
                      Upload an Excel file to bulk register students. Supports password-protected files.
                    </DialogDescription>
                  </DialogHeader>
                  
                  {/* Step 1: Upload */}
                  {importStep === 'upload' && (
                    <div className="space-y-4 py-4">
                      <div className="border-2 border-dashed rounded-lg p-8 text-center">
                        <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <Label htmlFor="excel-upload" className="cursor-pointer">
                          <span className="text-primary hover:underline">Choose Excel file</span>
                          <span className="text-muted-foreground"> or drag and drop</span>
                        </Label>
                        <Input
                          id="excel-upload"
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        {importFile && (
                          <p className="mt-4 text-sm text-green-600 flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                          </p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="password">File Password (if protected)</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="Leave empty if not password protected"
                          value={importPassword}
                          onChange={(e) => setImportPassword(e.target.value)}
                        />
                      </div>
                      
                      <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
                        <p className="font-medium">Expected Columns:</p>
                        <p className="text-muted-foreground">
                          Quadcare Account Number, Title, First Name, Last Name, I.D Number, DOB, Gender, Cell, Email, Employer, Occupation, Status
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          • All students (New and Existing at Campus Africa) will be imported<br/>
                          • Rows with invalid/missing email will be skipped<br/>
                          • Duplicate emails (already in Quadcare) will be skipped<br/>
                          • Students can use "Forgot Password" to set their login password
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Step 2: Preview */}
                  {importStep === 'preview' && importPreview && (
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                          <p className="text-2xl font-bold text-green-600">{importPreview.summary.to_import}</p>
                          <p className="text-sm text-muted-foreground">To Import</p>
                        </div>
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                          <p className="text-2xl font-bold text-blue-600">{importPreview.summary.duplicates || 0}</p>
                          <p className="text-sm text-muted-foreground">Already in Quadcare</p>
                        </div>
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                          <p className="text-2xl font-bold text-red-600">{importPreview.summary.errors}</p>
                          <p className="text-sm text-muted-foreground">Invalid Email</p>
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground">
                        Preview of first 10 rows from {importPreview.total_rows} total rows:
                      </p>
                      
                      <div className="border rounded-lg overflow-x-auto max-h-[300px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">#</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Phone</TableHead>
                              <TableHead>CA Status</TableHead>
                              <TableHead>Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {importPreview.preview_rows.map((row: any) => (
                              <TableRow key={row.row_number}>
                                <TableCell className="font-mono text-xs">{row.row_number}</TableCell>
                                <TableCell>{row.first_name} {row.last_name}</TableCell>
                                <TableCell className="text-xs">{row.email}</TableCell>
                                <TableCell className="text-xs">{row.phone}</TableCell>
                                <TableCell>
                                  <Badge variant={row.status?.includes('existing') ? 'secondary' : 'outline'}>
                                    {row.status || 'New'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {row.import_action === 'import' ? (
                                    <Badge variant="default" className="bg-green-600">
                                      <CheckCircle2 className="w-3 h-3 mr-1" />
                                      Import
                                    </Badge>
                                  ) : row.import_action === 'duplicate' ? (
                                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                      Duplicate
                                    </Badge>
                                  ) : (
                                    <Badge variant="destructive">
                                      <AlertCircle className="w-3 h-3 mr-1" />
                                      Error
                                    </Badge>
                                  )}
                                  {row.validation_errors?.length > 0 && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {row.validation_errors.join(', ')}
                                    </p>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                  
                  {/* Step 3: Importing */}
                  {importStep === 'importing' && (
                    <div className="space-y-4 py-8 text-center">
                      <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
                      <p className="text-lg font-medium">Importing students...</p>
                      <p className="text-sm text-muted-foreground">
                        This may take a few minutes for large files. Please don't close this dialog.
                      </p>
                      <Progress value={undefined} className="w-full" />
                    </div>
                  )}
                  
                  {/* Step 4: Complete */}
                  {importStep === 'complete' && importResult && (
                    <div className="space-y-4 py-4">
                      <div className="text-center py-4">
                        <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
                        <p className="text-xl font-bold">Import Complete!</p>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-4">
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                          <p className="text-2xl font-bold text-green-600">{importResult.summary.imported}</p>
                          <p className="text-sm text-muted-foreground">Imported</p>
                        </div>
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
                          <p className="text-2xl font-bold text-yellow-600">{importResult.summary.skipped}</p>
                          <p className="text-sm text-muted-foreground">Skipped</p>
                        </div>
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                          <p className="text-2xl font-bold text-blue-600">{importResult.summary.duplicates}</p>
                          <p className="text-sm text-muted-foreground">Duplicates</p>
                        </div>
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                          <p className="text-2xl font-bold text-red-600">{importResult.summary.errors}</p>
                          <p className="text-sm text-muted-foreground">Errors</p>
                        </div>
                      </div>
                      
                      {importResult.details?.length > 0 && (
                        <div className="border rounded-lg overflow-x-auto max-h-[200px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12">#</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Details</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {importResult.details.slice(0, 20).map((item: any, idx: number) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-mono text-xs">{item.row}</TableCell>
                                  <TableCell className="text-xs">{item.email}</TableCell>
                                  <TableCell>
                                    <Badge 
                                      variant={
                                        item.status === 'imported' ? 'default' : 
                                        item.status === 'skipped' ? 'secondary' :
                                        item.status === 'duplicate' ? 'outline' : 'destructive'
                                      }
                                      className={item.status === 'imported' ? 'bg-green-600' : ''}
                                    >
                                      {item.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{item.reason}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                      
                      <p className="text-sm text-muted-foreground text-center">
                        Students can now log in using "Forgot Password" to set their password.
                      </p>
                    </div>
                  )}
                  
                  <DialogFooter>
                    {importStep === 'upload' && (
                      <Button onClick={handlePreview} disabled={!importFile || importLoading}>
                        {importLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            Preview File
                          </>
                        )}
                      </Button>
                    )}
                    
                    {importStep === 'preview' && (
                      <>
                        <Button variant="outline" onClick={() => setImportStep('upload')}>
                          Back
                        </Button>
                        <Button onClick={handleImport} disabled={importLoading || importPreview?.summary?.to_import === 0}>
                          {importLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Importing...
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4 mr-2" />
                              Import {importPreview?.summary?.to_import} Students
                            </>
                          )}
                        </Button>
                      </>
                    )}
                    
                    {importStep === 'complete' && (
                      <Button onClick={() => {
                        setShowImportDialog(false);
                        resetImport();
                      }}>
                        Done
                      </Button>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>

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
