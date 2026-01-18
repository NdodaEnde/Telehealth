import { Card, CardContent } from "@/components/ui/card";
import { Users, Stethoscope, ClipboardList, Calendar } from "lucide-react";
import { QueueStats } from "@/hooks/usePatientQueue";

interface ClinicianStatsProps {
  stats: QueueStats;
  pendingNotes: number;
}

export const ClinicianStats = ({ stats, pendingNotes }: ClinicianStatsProps) => {
  const statCards = [
    {
      label: "Today's Queue",
      value: stats.waiting,
      icon: Users,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      label: "Completed Today",
      value: stats.completed,
      icon: Stethoscope,
      iconBg: "bg-success/10",
      iconColor: "text-success",
    },
    {
      label: "Pending Notes",
      value: pendingNotes,
      icon: ClipboardList,
      iconBg: "bg-warning/10",
      iconColor: "text-warning",
    },
    {
      label: "Total Scheduled",
      value: stats.total,
      icon: Calendar,
      iconBg: "bg-secondary/20",
      iconColor: "text-secondary-foreground",
    },
  ];

  return (
    <div className="grid md:grid-cols-4 gap-6">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-xl ${stat.iconBg}`}>
                  <Icon className={`w-6 h-6 ${stat.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
