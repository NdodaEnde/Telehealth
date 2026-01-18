import { 
  Calendar, 
  Video, 
  FileText, 
  CreditCard, 
  Shield, 
  BarChart3,
  Stethoscope,
  ClipboardCheck,
  Users
} from "lucide-react";

const FeaturesSection = () => {
  const features = [
    {
      icon: Calendar,
      title: "Smart Booking",
      description: "Self-service appointment scheduling with intelligent symptom assessment and urgency triaging.",
      color: "bg-primary/10 text-primary",
    },
    {
      icon: Stethoscope,
      title: "Symptom Checker",
      description: "AI-powered preliminary assessment to route patients to the right level of care.",
      color: "bg-info/10 text-info",
    },
    {
      icon: Users,
      title: "Clinical Workflow",
      description: "Seamless nurse triage to doctor escalation with complete patient handoff documentation.",
      color: "bg-secondary/10 text-secondary",
    },
    {
      icon: Video,
      title: "HD Video Consults",
      description: "Secure, high-quality video consultations with screen sharing and file transfer.",
      color: "bg-success/10 text-success",
    },
    {
      icon: FileText,
      title: "E-Prescriptions",
      description: "Digital prescriptions with ICD-10 coding, sent directly to pharmacies via HealthBridge.",
      color: "bg-warning/10 text-warning",
    },
    {
      icon: CreditCard,
      title: "Medical Aid Billing",
      description: "Real-time benefit verification and automatic claim submission to medical schemes.",
      color: "bg-primary/10 text-primary",
    },
    {
      icon: ClipboardCheck,
      title: "Clinical Notes",
      description: "Structured SOAP notes with ICD-10 coding and automatic EHR synchronization.",
      color: "bg-info/10 text-info",
    },
    {
      icon: Shield,
      title: "POPIA Compliant",
      description: "Full data protection with encrypted storage, audit trails, and patient consent management.",
      color: "bg-success/10 text-success",
    },
    {
      icon: BarChart3,
      title: "Analytics Dashboard",
      description: "Clinical quality metrics, utilization reports, and billing analytics for practice management.",
      color: "bg-secondary/10 text-secondary",
    },
  ];

  return (
    <section id="services" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent rounded-full mb-6">
            <span className="text-sm font-medium text-accent-foreground">
              Complete Telehealth Ecosystem
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Everything You Need for{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-[hsl(180,45%,45%)]">Digital Healthcare</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            From patient self-service to clinical documentation, our platform handles the entire consultation lifecycle.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group bg-card rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-all duration-300 border border-border/50 hover:border-primary/20"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className={`w-14 h-14 rounded-xl ${feature.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                <feature.icon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
