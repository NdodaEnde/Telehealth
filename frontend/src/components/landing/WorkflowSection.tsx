import { ArrowRight, User, ClipboardList, Stethoscope, Video, FileCheck, CreditCard } from "lucide-react";

const WorkflowSection = () => {
  const steps = [
    {
      number: "01",
      icon: User,
      title: "Patient Registration",
      description: "Quick signup with ID verification, medical history, and medical aid details capture.",
      color: "bg-primary",
    },
    {
      number: "02",
      icon: ClipboardList,
      title: "Symptom Assessment",
      description: "AI-guided symptom checker determines urgency and appropriate care pathway.",
      color: "bg-info",
    },
    {
      number: "03",
      icon: Stethoscope,
      title: "Nurse Triage",
      description: "Qualified nurse reviews case, gathers vitals, and prepares patient for consultation.",
      color: "bg-secondary",
    },
    {
      number: "04",
      icon: Video,
      title: "Doctor Consultation",
      description: "HD video call with board-certified physician, complete with screen sharing.",
      color: "bg-success",
    },
    {
      number: "05",
      icon: FileCheck,
      title: "Documentation",
      description: "Structured clinical notes, ICD-10 codes, and e-prescriptions generated automatically.",
      color: "bg-warning",
    },
    {
      number: "06",
      icon: CreditCard,
      title: "Billing & Follow-up",
      description: "Automatic medical aid claim or payment processing with follow-up scheduling.",
      color: "bg-primary",
    },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent rounded-full mb-6">
            <span className="text-sm font-medium text-accent-foreground">
              Seamless Patient Journey
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            How{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-[hsl(180,45%,45%)]">Quadcare Telehealth</span>{" "}
            Works
          </h2>
          <p className="text-lg text-muted-foreground">
            A fully digitized workflow from first contact to follow-up care, designed for South African healthcare compliance.
          </p>
        </div>

        {/* Workflow Steps */}
        <div className="relative">
          {/* Connection Line - Desktop */}
          <div className="hidden lg:block absolute top-24 left-[8.33%] right-[8.33%] h-0.5 bg-gradient-to-r from-primary via-success to-primary" />

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className="relative group"
              >
                {/* Step Card */}
                <div className="bg-card rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-all duration-300 border border-border/50 h-full">
                  {/* Step Number Badge */}
                  <div className="flex items-start justify-between mb-6">
                    <div className={`w-16 h-16 rounded-2xl ${step.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <step.icon className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <span className="text-5xl font-bold text-muted/30 group-hover:text-primary/20 transition-colors">
                      {step.number}
                    </span>
                  </div>

                  <h3 className="text-xl font-semibold text-foreground mb-3">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Arrow Connector - Mobile */}
                {index < steps.length - 1 && (
                  <div className="lg:hidden flex justify-center py-4">
                    <ArrowRight className="w-6 h-6 text-primary rotate-90" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default WorkflowSection;
