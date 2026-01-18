import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { authAPI } from "@/lib/api";
import { toast } from "sonner";

interface PasswordResetProps {
  onBack: () => void;
}

export const PasswordReset = ({ onBack }: PasswordResetProps) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    setLoading(true);
    
    try {
      await authAPI.requestPasswordReset(email);
      setSent(true);
      toast.success("Password reset link sent!");
    } catch (error: any) {
      // Don't show error - for security we always show success
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6 text-center">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Check Your Email</h3>
          <p className="text-muted-foreground mb-6">
            If an account exists with <strong>{email}</strong>, you will receive a password reset link shortly.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Please check your spam folder if you don't see the email within a few minutes.
          </p>
          <Button onClick={onBack} variant="outline" className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sign In
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-4">
          <Mail className="w-6 h-6 text-primary-foreground" />
        </div>
        <CardTitle>Reset Password</CardTitle>
        <CardDescription>
          Enter your email address and we'll send you a link to reset your password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Send Reset Link
              </>
            )}
          </Button>
          
          <Button 
            type="button" 
            variant="ghost" 
            className="w-full" 
            onClick={onBack}
            disabled={loading}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sign In
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
