import { Button } from "@/components/ui/button";
import { Calendar, ArrowRight, Phone } from "lucide-react";

const CTASection = () => {
  return (
    <section className="py-24 bg-background relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="gradient-primary rounded-3xl p-12 md:p-16 shadow-2xl">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6">
              Ready to Transform Your Healthcare Experience?
            </h2>
            <p className="text-lg md:text-xl text-primary-foreground/80 mb-10 max-w-2xl mx-auto">
              Join thousands of patients across Gauteng and Limpopo who've already made the switch to convenient, compliant telehealth.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="heroOutline" size="xl" className="group">
                <Calendar className="w-5 h-5" />
                Book Your First Consultation
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                variant="ghost" 
                size="xl" 
                className="text-primary-foreground hover:bg-primary-foreground/10"
              >
                <Phone className="w-5 h-5" />
                0800 QUADCARE
              </Button>
            </div>

            <p className="text-primary-foreground/60 text-sm mt-8">
              No registration fees • Medical aid accepted • Available 7 days a week
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
