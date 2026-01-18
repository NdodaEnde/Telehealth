import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Video } from "lucide-react";
import { ConsultationTypeStats } from "@/hooks/useAnalytics";

interface ConsultationTypesChartProps {
  data: ConsultationTypeStats;
}

const COLORS = ['hsl(174, 62%, 38%)', 'hsl(38, 92%, 50%)', 'hsl(16, 85%, 60%)'];

export const ConsultationTypesChart = ({ data }: ConsultationTypesChartProps) => {
  const chartData = [
    { name: 'Video', value: data.video, icon: '📹' },
    { name: 'Phone', value: data.phone, icon: '📞' },
    { name: 'In-Person', value: data.in_person, icon: '🏥' },
  ].filter(item => item.value > 0);

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Consultation Types</CardTitle>
          </div>
          <CardDescription>Distribution by type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            No consultation data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Video className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Consultation Types</CardTitle>
        </div>
        <CardDescription>Distribution by type</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`${value} (${((value / total) * 100).toFixed(1)}%)`, 'Count']}
                contentStyle={{ 
                  backgroundColor: 'hsl(0, 0%, 100%)',
                  border: '1px solid hsl(210, 20%, 90%)',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Legend 
                formatter={(value) => <span className="text-sm">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
