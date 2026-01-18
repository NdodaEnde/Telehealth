import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp } from "lucide-react";
import { AppointmentTrend } from "@/hooks/useAnalytics";
import { format, parseISO } from "date-fns";

interface AppointmentTrendsChartProps {
  data: AppointmentTrend[];
}

export const AppointmentTrendsChart = ({ data }: AppointmentTrendsChartProps) => {
  const chartData = data.map(item => ({
    ...item,
    date: format(parseISO(item.date), 'MMM d'),
    pending: item.count - item.completed - item.cancelled
  }));

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Appointment Trends</CardTitle>
        </div>
        <CardDescription>Daily appointment volume over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(174, 62%, 38%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(174, 62%, 38%)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(152, 60%, 42%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(152, 60%, 42%)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 20%, 90%)" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11, fill: 'hsl(215, 15%, 45%)' }}
                axisLine={{ stroke: 'hsl(210, 20%, 90%)' }}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: 'hsl(215, 15%, 45%)' }}
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
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Area 
                type="monotone" 
                dataKey="count" 
                name="Total"
                stroke="hsl(174, 62%, 38%)" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorTotal)" 
              />
              <Area 
                type="monotone" 
                dataKey="completed" 
                name="Completed"
                stroke="hsl(152, 60%, 42%)" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorCompleted)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
