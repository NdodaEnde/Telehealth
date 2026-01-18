import { Button } from "@/components/ui/button";
import { Calendar, Video, Shield, ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-medical.jpg";

const HeroSection = () => {
  const benefits = [
    "HPCSA Compliant Consultations",
    "POPIA Protected Data",
    "Medical Aid Integration",
  ];

  return (
    <section className="relative min-h-screen flex items-center pt-16 sm:pt-20 lg:pt-0 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/20" />
        <div className="absolute top-1/4 right-0 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[200px] sm:w-[400px] h-[200px] sm:h-[400px] bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10 py-8 sm:py-12 lg:py-0">
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
          {/* Content */}
          <div className="space-y-5 sm:space-y-8 animate-slide-up">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-accent rounded-full">
              <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
              <span className="text-xs sm:text-sm font-medium text-accent-foreground">
                Serving 12 Quadcare Clinics Across South Africa
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
              Healthcare at Your{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-[hsl(180,45%,45%)]">
                Fingertips
              </span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
              Experience seamless telehealth consultations with qualified South African doctors. 
              From booking to prescription — all digitally compliant and medically integrated.
            </p>

            {/* Benefits - Stack on mobile */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

            {/* CTAs - Stack on mobile */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2 sm:pt-4">
              <Link to="/auth" className="w-full sm:w-auto">
                <Button variant="hero" size="xl" className="group w-full sm:w-auto">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Book Consultation</span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button variant="outline" size="xl" className="w-full sm:w-auto">
                <Video className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>How It Works</span>
              </Button>
            </div>

            {/* Trust Indicators - Wrap on mobile */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 pt-2 sm:pt-4 text-xs sm:text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <span>HPCSA Registered</span>
              </div>
              <div className="hidden sm:block h-4 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-accent border-2 border-card flex items-center justify-center text-[10px] sm:text-xs font-medium text-accent-foreground"
                    >
                      {i === 4 ? "5K+" : ""}
                    </div>
                  ))}
                </div>
                <span>Active Patients</span>
              </div>
            </div>
          </div>

          {/* Hero Image */}
          <div className="relative animate-fade-in order-first lg:order-last" style={{ animationDelay: "0.2s" }}>
            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl sm:shadow-2xl">
              <img
                src={heroImage}
                alt="HCF Telehealth Platform"
                className="w-full h-auto object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent" />
            </div>

            {/* Floating Cards - Hide some on mobile */}
            <div className="hidden sm:block absolute -left-4 lg:-left-8 top-1/4 glass-card rounded-xl p-3 sm:p-4 shadow-lg animate-float">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-success/20 flex items-center justify-center">
                  <Video className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Live Now</p>
                  <p className="font-semibold text-xs sm:text-sm">Dr. Mokoena</p>
                </div>
              </div>
            </div>

            <div className="absolute -right-2 sm:-right-4 lg:-right-8 bottom-1/4 glass-card rounded-xl p-3 sm:p-4 shadow-lg animate-float" style={{ animationDelay: "1s" }}>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Next Available</p>
                  <p className="font-semibold text-xs sm:text-sm">10:30 AM Today</p>
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
