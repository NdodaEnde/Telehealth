import { Building2, Users, Clock, Star } from "lucide-react";

const StatsSection = () => {
  const stats = [
    {
      icon: Building2,
      value: "12",
      label: "Quadcare Clinics",
      sublabel: "Gauteng & Limpopo",
    },
    {
      icon: Users,
      value: "5,000+",
      label: "Active Patients",
      sublabel: "And growing",
    },
    {
      icon: Clock,
      value: "<15min",
      label: "Avg Wait Time",
      sublabel: "For consultations",
    },
    {
      icon: Star,
      value: "4.8",
      label: "Patient Rating",
      sublabel: "Out of 5 stars",
    },
  ];

  return (
    <section className="py-16 gradient-hero">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="text-center group"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm mb-4 group-hover:scale-110 transition-transform duration-300">
                <stat.icon className="w-8 h-8 text-primary-foreground" />
              </div>
              <div className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-2">
                {stat.value}
              </div>
              <div className="text-primary-foreground/90 font-medium">
                {stat.label}
              </div>
              <div className="text-primary-foreground/60 text-sm">
                {stat.sublabel}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
