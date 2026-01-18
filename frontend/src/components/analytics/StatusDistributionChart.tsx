import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";

interface StatusDistributionChartProps {
  data: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'hsl(38, 92%, 50%)',
  confirmed: 'hsl(210, 80%, 55%)',
  in_progress: 'hsl(174, 62%, 38%)',
  completed: 'hsl(152, 60%, 42%)',
  cancelled: 'hsl(0, 72%, 51%)'
};

export const StatusDistributionChart = ({ data }: StatusDistributionChartProps) => {
  const chartData = Object.entries(data).map(([status, count]) => ({
    status: status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1),
    count,
    color: STATUS_COLORS[status] || 'hsl(215, 15%, 45%)'
  }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Status Distribution</CardTitle>
          </div>
          <CardDescription>Appointment status breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            No status data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <PieChartIcon className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Status Distribution</CardTitle>
        </div>
        <CardDescription>Appointment status breakdown</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 20%, 90%)" horizontal={false} />
              <XAxis 
                type="number"
                tick={{ fontSize: 11, fill: 'hsl(215, 15%, 45%)' }}
                axisLine={{ stroke: 'hsl(210, 20%, 90%)' }}
                tickLine={false}
              />
              <YAxis 
                type="category"
                dataKey="status"
                tick={{ fontSize: 11, fill: 'hsl(215, 15%, 45%)' }}
                axisLine={{ stroke: 'hsl(210, 20%, 90%)' }}
                tickLine={false}
                width={80}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(0, 0%, 100%)',
                  border: '1px solid hsl(210, 20%, 90%)',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
