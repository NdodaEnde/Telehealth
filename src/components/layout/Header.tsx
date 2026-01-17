import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Phone, Calendar, User, FileText } from "lucide-react";
import { Link } from "react-router-dom";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = [
    { label: "How It Works", href: "#how-it-works" },
    { label: "Services", href: "#services" },
    { label: "For Clinicians", href: "#clinicians" },
    { label: "Contact", href: "#contact" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-md">
              <span className="text-primary-foreground font-bold text-lg">H</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg text-foreground leading-tight">HCF</span>
              <span className="text-xs text-muted-foreground leading-tight">Telehealth</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-3">
            <Button variant="ghost" size="sm" className="gap-2">
              <Phone className="w-4 h-4" />
              0800 HCF CARE
            </Button>
            <Button variant="outline" size="sm">
              Sign In
            </Button>
            <Button variant="default" size="sm">
              Book Consultation
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-2 hover:bg-accent rounded-lg transition-colors"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="lg:hidden py-4 border-t border-border animate-fade-in">
            <nav className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="px-4 py-3 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-accent rounded-lg transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-2 mt-4 px-4">
                <Button variant="outline" className="w-full">
                  Sign In
                </Button>
                <Button variant="default" className="w-full">
                  Book Consultation
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
