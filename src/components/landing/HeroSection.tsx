import { Button } from "@/components/ui/button";
import { Calendar, Video, Shield, ArrowRight, CheckCircle2 } from "lucide-react";
import heroImage from "@/assets/hero-medical.jpg";

const HeroSection = () => {
  const benefits = [
    "HPCSA Compliant Consultations",
    "POPIA Protected Data",
    "Medical Aid Integration",
  ];

  return (
    <section className="relative min-h-screen flex items-center pt-20 lg:pt-0 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/20" />
        <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Content */}
          <div className="space-y-8 animate-slide-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent rounded-full">
              <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
              <span className="text-sm font-medium text-accent-foreground">
                Serving 12 Quadcare Clinics Across South Africa
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
              Healthcare at Your{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-[hsl(180,45%,45%)]">Fingertips</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
              Experience seamless telehealth consultations with qualified South African doctors. 
              From booking to prescription — all digitally compliant and medically integrated.
            </p>

            {/* Benefits */}
            <div className="flex flex-wrap gap-4">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button variant="hero" size="xl" className="group">
                <Calendar className="w-5 h-5" />
                Book Consultation
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="outline" size="xl">
                <Video className="w-5 h-5" />
                How It Works
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="flex items-center gap-6 pt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <span>HPCSA Registered</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-accent border-2 border-card flex items-center justify-center text-xs font-medium text-accent-foreground"
                  >
                    {i === 4 ? "5K+" : ""}
                  </div>
                ))}
              </div>
              <span>Active Patients</span>
            </div>
          </div>

          {/* Hero Image */}
          <div className="relative animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <div className="relative rounded-3xl overflow-hidden shadow-2xl">
              <img
                src={heroImage}
                alt="HCF Telehealth Platform"
                className="w-full h-auto object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent" />
            </div>

            {/* Floating Cards */}
            <div className="absolute -left-4 lg:-left-8 top-1/4 glass-card rounded-xl p-4 shadow-lg animate-float">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                  <Video className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Live Now</p>
                  <p className="font-semibold text-sm">Dr. Mokoena</p>
                </div>
              </div>
            </div>

            <div className="absolute -right-4 lg:-right-8 bottom-1/4 glass-card rounded-xl p-4 shadow-lg animate-float" style={{ animationDelay: "1s" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Next Available</p>
                  <p className="font-semibold text-sm">10:30 AM Today</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
