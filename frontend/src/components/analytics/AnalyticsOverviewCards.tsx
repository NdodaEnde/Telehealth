import { Card, CardContent } from "@/components/ui/card";
import { 
  Users, 
  UserCheck, 
  Stethoscope, 
  Calendar, 
  Video, 
  Pill,
  TrendingUp,
  Clock
} from "lucide-react";
import { AnalyticsOverview } from "@/hooks/useAnalytics";

interface AnalyticsOverviewCardsProps {
  overview: AnalyticsOverview;
}

export const AnalyticsOverviewCards = ({ overview }: AnalyticsOverviewCardsProps) => {
  const cards = [
    {
      title: "Total Users",
      value: overview.total_users,
      icon: Users,
      color: "bg-primary/10 text-primary",
      description: `${overview.total_patients} patients, ${overview.total_clinicians} clinicians`
    },
    {
      title: "Total Appointments",
      value: overview.total_appointments,
      icon: Calendar,
      color: "bg-success/10 text-success",
      description: `${overview.appointments_today} today, ${overview.appointments_this_week} this week`
    },
    {
      title: "Consultations",
      value: overview.total_consultations,
      icon: Video,
      color: "bg-info/10 text-info",
      description: `${overview.average_consultation_duration.toFixed(1)} min avg duration`
    },
    {
      title: "Prescriptions",
      value: overview.total_prescriptions,
      icon: Pill,
      color: "bg-warning/10 text-warning",
      description: "Total issued"
    },
    {
      title: "Completion Rate",
      value: `${overview.completion_rate}%`,
      icon: TrendingUp,
      color: "bg-success/10 text-success",
      description: "Appointments completed"
    },
    {
      title: "This Month",
      value: overview.appointments_this_month,
      icon: Clock,
      color: "bg-secondary/20 text-secondary-foreground",
      description: "Appointments scheduled"
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card, index) => (
        <Card key={index} className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${card.color}`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{card.value}</p>
            <p className="text-xs text-muted-foreground font-medium">{card.title}</p>
            <p className="text-xs text-muted-foreground mt-1 truncate">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
