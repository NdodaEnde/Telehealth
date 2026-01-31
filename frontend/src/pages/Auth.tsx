import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Mail, Lock, User, Phone, Shield, UserCheck, Loader2 } from "lucide-react";
import { PasswordReset } from "@/components/auth/PasswordReset";
import { authAPI } from "@/lib/api";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(50, "First name too long"),
  last_name: z.string().min(1, "Last name is required").max(50, "Last name too long"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirm_password: z.string(),
  role: z.enum(["patient", "nurse", "doctor", "receptionist"] as const),
  hpcsa_number: z.string().optional(),
}).refine((data) => data.password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
}).refine((data) => {
  if ((data.role === "nurse" || data.role === "doctor") && !data.hpcsa_number) {
    return false;
  }
  return true;
}, {
  message: "HPCSA number is required for healthcare professionals",
  path: ["hpcsa_number"],
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole>("patient");
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  
  // Bulk-imported user state
  const [bulkImportedUser, setBulkImportedUser] = useState<{
    email: string;
    firstName: string;
  } | null>(null);
  const [isCheckingAccount, setIsCheckingAccount] = useState(false);
  const [isSendingLink, setIsSendingLink] = useState(false);
  
  const { signIn, signUp, user, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const from = location.state?.from?.pathname || "/";

  // Redirect if already logged in
  useEffect(() => {
    if (user && role) {
      const roleRoutes: Record<AppRole, string> = {
        patient: "/patient",
        nurse: "/clinician",
        doctor: "/clinician",
        admin: "/admin",
        receptionist: "/receptionist",
      };
      navigate(roleRoutes[role], { replace: true });
    }
  }, [user, role, navigate]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      confirm_password: "",
      role: "patient",
      hpcsa_number: "",
    },
  });

  const handleLogin = async (data: LoginFormData) => {
    setIsSubmitting(true);
    
    // First check if this is a bulk-imported user who needs to set password
    try {
      setIsCheckingAccount(true);
      const checkResult = await authAPI.checkAccount(data.email);
      setIsCheckingAccount(false);
      
      if (checkResult?.data?.needs_password_setup) {
        // This is a bulk-imported user who hasn't set their password yet
        setBulkImportedUser({
          email: data.email,
          firstName: checkResult.data.first_name || 'there',
        });
        setIsSubmitting(false);
        return;
      }
    } catch (err) {
      console.error("Account check failed:", err);
      // Continue with normal login if check fails
    }
    setIsCheckingAccount(false);
    
    // Normal login flow
    const { error } = await signIn(data.email, data.password);
    setIsSubmitting(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message === "Invalid login credentials"
          ? "Invalid email or password. Please try again."
          : error.message,
      });
    }
  };

  const handleSendSetupLink = async () => {
    if (!bulkImportedUser) return;
    
    setIsSendingLink(true);
    try {
      const result = await authAPI.sendSetupLink(bulkImportedUser.email);
      
      if (result?.data?.test_mode) {
        toast({
          title: "Testing Mode",
          description: "Email sending is disabled during testing. Please use 'Forgot Password' to set your password, or contact your administrator.",
        });
      } else if (result?.data?.email_sent) {
        toast({
          title: "Email sent!",
          description: "Check your inbox for a link to set your password.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Could not send email",
          description: result?.message || "Please try again or use 'Forgot Password'.",
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not send setup link. Please try 'Forgot Password' instead.",
      });
    }
    setIsSendingLink(false);
  };

  const handleSignup = async (data: SignupFormData) => {
    setIsSubmitting(true);
    const { error } = await signUp(data.email, data.password, {
      first_name: data.first_name,
      last_name: data.last_name,
      role: data.role,
      hpcsa_number: data.hpcsa_number,
    });
    setIsSubmitting(false);

    if (error) {
      if (error.message.includes("already registered")) {
        toast({
          variant: "destructive",
          title: "Account exists",
          description: "An account with this email already exists. Please sign in instead.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Signup failed",
          description: error.message,
        });
      }
    } else {
      toast({
        title: "Account created!",
        description: "Welcome to Quadcare Telehealth. Redirecting to your dashboard...",
      });
    }
  };

  const handleRoleChange = (value: string) => {
    setSelectedRole(value as AppRole);
    signupForm.setValue("role", value as "patient" | "nurse" | "doctor" | "receptionist");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img 
            src="/quadcare-logo.png" 
            alt="Quadcare" 
            className="h-16 w-auto"
          />
        </div>

        {/* Password Reset View */}
        {showPasswordReset ? (
          <PasswordReset onBack={() => setShowPasswordReset(false)} />
        ) : bulkImportedUser ? (
          /* Bulk-imported user welcome screen */
          <Card className="border-border/50 shadow-xl">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 rounded-full bg-primary/10">
                  <UserCheck className="w-10 h-10 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl">
                Welcome, {bulkImportedUser.firstName}!
              </CardTitle>
              <CardDescription className="mt-2">
                Your account has been pre-registered by <strong>Campus Africa</strong>.
                <br />
                Please set a password to get started.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 text-sm">
                <p className="text-muted-foreground">
                  Your email: <strong>{bulkImportedUser.email}</strong>
                </p>
              </div>
              
              <Button 
                onClick={handleSendSetupLink} 
                className="w-full" 
                size="lg"
                disabled={isSendingLink}
              >
                {isSendingLink ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send Password Setup Link
                  </>
                )}
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>
              
              <Button
                variant="outline"
                onClick={() => setShowPasswordReset(true)}
                className="w-full"
              >
                Use Forgot Password
              </Button>
              
              <button
                type="button"
                onClick={() => setBulkImportedUser(null)}
                className="w-full text-sm text-muted-foreground hover:text-foreground"
              >
                ← Back to login
              </button>
            </CardContent>
          </Card>
        ) : (
        <Card className="border-border/50 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {isLogin ? "Welcome back" : "Create your account"}
            </CardTitle>
            <CardDescription>
              {isLogin
                ? "Sign in to access your healthcare portal"
                : "Join Quadcare Telehealth for quality healthcare"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLogin ? (
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10"
                      {...loginForm.register("email")}
                    />
                  </div>
                  {loginForm.formState.errors.email && (
                    <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10"
                      {...loginForm.register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? "Signing in..." : "Sign In"}
                </Button>

                <button
                  type="button"
                  onClick={() => setShowPasswordReset(true)}
                  className="w-full text-sm text-primary hover:underline mt-2"
                >
                  Forgot your password?
                </button>
              </form>
            ) : (
              <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="first_name"
                        placeholder="John"
                        className="pl-10"
                        {...signupForm.register("first_name")}
                      />
                    </div>
                    {signupForm.formState.errors.first_name && (
                      <p className="text-sm text-destructive">{signupForm.formState.errors.first_name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      placeholder="Doe"
                      {...signupForm.register("last_name")}
                    />
                    {signupForm.formState.errors.last_name && (
                      <p className="text-sm text-destructive">{signupForm.formState.errors.last_name.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10"
                      {...signupForm.register("email")}
                    />
                  </div>
                  {signupForm.formState.errors.email && (
                    <p className="text-sm text-destructive">{signupForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">I am a</Label>
                  <Select value={selectedRole} onValueChange={handleRoleChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="patient">Patient</SelectItem>
                      <SelectItem value="receptionist">Receptionist</SelectItem>
                      <SelectItem value="nurse">Nurse</SelectItem>
                      <SelectItem value="doctor">Doctor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(selectedRole === "nurse" || selectedRole === "doctor") && (
                  <div className="space-y-2">
                    <Label htmlFor="hpcsa_number">HPCSA Registration Number</Label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="hpcsa_number"
                        placeholder="MP 0123456"
                        className="pl-10"
                        {...signupForm.register("hpcsa_number")}
                      />
                    </div>
                    {signupForm.formState.errors.hpcsa_number && (
                      <p className="text-sm text-destructive">{signupForm.formState.errors.hpcsa_number.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Required for healthcare professionals per HPCSA guidelines
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10"
                      {...signupForm.register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {signupForm.formState.errors.password && (
                    <p className="text-sm text-destructive">{signupForm.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm_password">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="confirm_password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10"
                      {...signupForm.register("confirm_password")}
                    />
                  </div>
                  {signupForm.formState.errors.confirm_password && (
                    <p className="text-sm text-destructive">{signupForm.formState.errors.confirm_password.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            )}

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-primary hover:underline"
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </CardContent>
        </Card>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy.
          <br />
          Your data is protected under POPIA regulations.
        </p>
      </div>
    </div>
  );
};

export default Auth;
