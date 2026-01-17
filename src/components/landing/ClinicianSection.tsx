import { Button } from "@/components/ui/button";
import { 
  Laptop, 
  Clock, 
  FileText, 
  Video, 
  BarChart3, 
  Shield,
  ArrowRight,
  CheckCircle2
} from "lucide-react";

const ClinicianSection = () => {
  const benefits = [
    {
      icon: Laptop,
      title: "Unified Dashboard",
      description: "All patient queues, schedules, and clinical tools in one interface.",
    },
    {
      icon: Clock,
      title: "Smart Scheduling",
      description: "AI-optimized appointment slots based on consultation type and duration.",
    },
    {
      icon: FileText,
      title: "Auto Documentation",
      description: "Structured notes with ICD-10 suggestions and HPCSA compliant templates.",
    },
    {
      icon: Video,
      title: "HD Consultations",
      description: "Crystal clear video with screen sharing, annotations, and recordings.",
    },
    {
      icon: BarChart3,
      title: "Performance Analytics",
      description: "Track consultation metrics, patient outcomes, and earnings in real-time.",
    },
    {
      icon: Shield,
      title: "Medico-Legal Protection",
      description: "Full audit trails, consent management, and compliant documentation.",
    },
  ];

  const checkpoints = [
    "Reduced admin time by 60%",
    "Automatic HealthBridge sync",
    "Mobile-friendly interface",
    "Multi-clinic support",
  ];

  return (
    <section id="clinicians" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent rounded-full">
              <span className="text-sm font-medium text-accent-foreground">
                For Healthcare Providers
              </span>
            </div>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
              Empower Your{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-[hsl(180,45%,45%)]">Clinical Practice</span>
            </h2>

            <p className="text-lg text-muted-foreground leading-relaxed">
              Purpose-built for South African healthcare professionals. Streamline your telehealth workflow 
              while maintaining full HPCSA compliance and clinical quality standards.
            </p>

            {/* Checkpoints */}
            <div className="grid grid-cols-2 gap-4">
              {checkpoints.map((point) => (
                <div key={point} className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{point}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-4 pt-4">
              <Button variant="hero" size="lg" className="group">
                Join as Provider
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="outline" size="lg">
                View Demo
              </Button>
            </div>
          </div>

          {/* Benefits Grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            {benefits.map((benefit, index) => (
              <div
                key={benefit.title}
                className="bg-card rounded-xl p-5 shadow-card hover:shadow-card-hover transition-all duration-300 border border-border/50 hover:border-primary/20 group"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <benefit.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  {benefit.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ClinicianSection;
