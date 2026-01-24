import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Facebook, Twitter, Linkedin, Instagram } from "lucide-react";

const Footer = () => {
  const links = {
    patients: [
      { label: "Book Consultation", href: "#" },
      { label: "Symptom Checker", href: "#" },
      { label: "Find a Doctor", href: "#" },
      { label: "Pricing", href: "#" },
      { label: "FAQs", href: "#" },
    ],
    providers: [
      { label: "Join as Doctor", href: "#" },
      { label: "Nurse Portal", href: "#" },
      { label: "Clinical Guidelines", href: "#" },
      { label: "Training Resources", href: "#" },
    ],
    company: [
      { label: "About Quadcare", href: "#" },
      { label: "Our Clinics", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Contact Us", href: "#" },
    ],
    legal: [
      { label: "Privacy Policy", href: "#" },
      { label: "Terms of Service", href: "#" },
      { label: "POPIA Compliance", href: "#" },
      { label: "Cookie Policy", href: "#" },
    ],
  };

  const socialLinks = [
    { icon: Facebook, href: "#", label: "Facebook" },
    { icon: Twitter, href: "#", label: "Twitter" },
    { icon: Linkedin, href: "#", label: "LinkedIn" },
    { icon: Instagram, href: "#", label: "Instagram" },
  ];

  return (
    <footer id="contact" className="bg-foreground text-primary-foreground pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 pb-12 border-b border-primary-foreground/10">
          {/* Logo & Contact */}
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">H</span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg text-primary-foreground leading-tight">Quadcare</span>
                <span className="text-xs text-primary-foreground/60 leading-tight">Telehealth</span>
              </div>
            </Link>
            <p className="text-primary-foreground/60 text-sm mb-6 max-w-xs">
              Digitizing healthcare for South Africa. Compliant, convenient, connected.
            </p>
            <div className="space-y-3">
              <a href="tel:0800423227" className="flex items-center gap-3 text-sm text-primary-foreground/80 hover:text-primary transition-colors">
                <Phone className="w-4 h-4" />
                0800 QUADCARE (0800 423 227)
              </a>
              <a href="mailto:support@hcf.quadcare.co.za" className="flex items-center gap-3 text-sm text-primary-foreground/80 hover:text-primary transition-colors">
                <Mail className="w-4 h-4" />
                support@hcf.quadcare.co.za
              </a>
              <div className="flex items-start gap-3 text-sm text-primary-foreground/60">
                <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Quadcare Head Office<br />Johannesburg, Gauteng</span>
              </div>
            </div>
          </div>

          {/* Link Columns */}
          <div>
            <h4 className="font-semibold text-primary-foreground mb-4">For Patients</h4>
            <ul className="space-y-3">
              {links.patients.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-primary-foreground/60 hover:text-primary transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-primary-foreground mb-4">For Providers</h4>
            <ul className="space-y-3">
              {links.providers.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-primary-foreground/60 hover:text-primary transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-primary-foreground mb-4">Company</h4>
            <ul className="space-y-3">
              {links.company.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-primary-foreground/60 hover:text-primary transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-primary-foreground mb-4">Legal</h4>
            <ul className="space-y-3">
              {links.legal.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-primary-foreground/60 hover:text-primary transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-primary-foreground/40">
            © 2026 Quadcare Telehealth by Quadcare. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                aria-label={social.label}
                className="w-10 h-10 rounded-lg bg-primary-foreground/5 hover:bg-primary-foreground/10 flex items-center justify-center transition-colors"
              >
                <social.icon className="w-5 h-5 text-primary-foreground/60" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
