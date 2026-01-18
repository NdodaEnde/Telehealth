import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, Trophy, TrendingUp, TrendingDown } from "lucide-react";
import { ClinicianPerformance } from "@/hooks/useAnalytics";

interface ClinicianPerformanceTableProps {
  data: ClinicianPerformance[];
}

export const ClinicianPerformanceTable = ({ data }: ClinicianPerformanceTableProps) => {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Clinician Performance</CardTitle>
          </div>
          <CardDescription>Top performing clinicians</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            No clinician data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Clinician Performance</CardTitle>
        </div>
        <CardDescription>Top performing clinicians by appointments</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.slice(0, 5).map((clinician, index) => (
            <div 
              key={clinician.clinician_id} 
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">Dr. {clinician.clinician_name}</p>
                  {index === 0 && (
                    <Badge variant="default" className="text-xs">
                      Top Performer
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span>{clinician.total_appointments} appointments</span>
                  <span>•</span>
                  <span>{clinician.completed_appointments} completed</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium">{clinician.completion_rate}%</p>
                  <p className="text-xs text-muted-foreground">Completion</p>
                </div>
                <div className="w-24">
                  <Progress 
                    value={clinician.completion_rate} 
                    className="h-2"
                  />
                </div>
                {clinician.completion_rate >= 80 ? (
                  <TrendingUp className="w-4 h-4 text-success" />
                ) : clinician.completion_rate >= 50 ? (
                  <TrendingUp className="w-4 h-4 text-warning" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-destructive" />
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
