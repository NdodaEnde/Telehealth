import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { UserPlus } from "lucide-react";
import { PatientGrowth } from "@/hooks/useAnalytics";
import { format, parseISO } from "date-fns";

interface PatientGrowthChartProps {
  data: PatientGrowth[];
}

export const PatientGrowthChart = ({ data }: PatientGrowthChartProps) => {
  const chartData = data.map(item => ({
    ...item,
    date: format(parseISO(item.date), 'MMM d')
  }));

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Patient Growth</CardTitle>
          </div>
          <CardDescription>New patient registrations over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            No growth data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full lg:col-span-1">
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Patient Growth</CardTitle>
        </div>
        <CardDescription>Total patients over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 20%, 90%)" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10, fill: 'hsl(215, 15%, 45%)' }}
                axisLine={{ stroke: 'hsl(210, 20%, 90%)' }}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: 'hsl(215, 15%, 45%)' }}
                axisLine={{ stroke: 'hsl(210, 20%, 90%)' }}
                tickLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(0, 0%, 100%)',
                  border: '1px solid hsl(210, 20%, 90%)',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Line 
                type="monotone" 
                dataKey="total_patients" 
                name="Total Patients"
                stroke="hsl(174, 62%, 38%)" 
                strokeWidth={2}
                dot={{ fill: 'hsl(174, 62%, 38%)', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
