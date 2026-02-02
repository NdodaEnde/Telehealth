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
import { 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  User, 
  Shield, 
  UserCheck, 
  Loader2,
  ArrowRight,
  Building2,
  CheckCircle2
} from "lucide-react";
import { PasswordReset } from "@/components/auth/PasswordReset";
import { authAPI } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

// Step 1: Email only
const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

// Step 2a: Password for existing users
const passwordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Step 2b: Set password for bulk-imported users
const setPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirm_password: z.string(),
}).refine((data) => data.password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
});

// Full signup schema for new users
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

type EmailFormData = z.infer<typeof emailSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;
type SetPasswordFormData = z.infer<typeof setPasswordSchema>;
type SignupFormData = z.infer<typeof signupSchema>;

// Auth flow steps
type AuthStep = 'email' | 'password' | 'set-password' | 'signup' | 'password-reset';

interface AccountStatus {
  exists: boolean;
  needs_password_setup: boolean;
  first_name: string;
  is_bulk_imported: boolean;
  corporate_client?: string;
}

const Auth = () => {
  // Flow state
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  
  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole>("patient");
  
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

  // Forms
  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "" },
  });

  const setPasswordForm = useForm<SetPasswordFormData>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: "", confirm_password: "" },
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

  // Step 1: Check email and determine next step
  const handleEmailSubmit = async (data: EmailFormData) => {
    setIsLoading(true);
    const emailLower = data.email.toLowerCase().trim();
    setEmail(emailLower);
    
    try {
      const result = await authAPI.checkAccount(emailLower);
      
      if (result?.data) {
        setAccountStatus(result.data);
        
        if (!result.data.exists) {
          // No account - go to signup
          toast({
            title: "No account found",
            description: "Let's create your account!",
          });
          signupForm.setValue('email', emailLower);
          setStep('signup');
        } else if (result.data.needs_password_setup) {
          // Bulk-imported user - needs to set password
          setStep('set-password');
        } else {
          // Existing user with password - show password input
          setStep('password');
        }
      } else {
        // API didn't return expected data, assume no account
        signupForm.setValue('email', emailLower);
        setStep('signup');
      }
    } catch (err) {
      console.error("Account check failed:", err);
      // On error, show password field (normal login attempt)
      setStep('password');
    }
    
    setIsLoading(false);
  };

  // Step 2a: Normal login with password
  const handlePasswordSubmit = async (data: PasswordFormData) => {
    setIsLoading(true);
    
    const { error } = await signIn(email, data.password);
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message === "Invalid login credentials"
          ? "Invalid password. Please try again."
          : error.message,
      });
    }
    
    setIsLoading(false);
  };

  // Step 2b: Set password for bulk-imported user
  const handleSetPassword = async (data: SetPasswordFormData) => {
    setIsLoading(true);
    
    try {
      // Use Supabase's updateUser with nonce from magic link, or use password recovery
      // Since bulk-imported users have no password, we'll use the password recovery flow
      // First, send the recovery email
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?type=recovery`,
      });
      
      if (resetError) {
        throw resetError;
      }
      
      toast({
        title: "Check your email!",
        description: "We've sent you a link to set your password. Click it to complete setup.",
      });
      
      // Show success state
      setStep('email');
      setAccountStatus(null);
      emailForm.reset();
      
    } catch (err: any) {
      console.error("Set password failed:", err);
      toast({
        variant: "destructive",
        title: "Failed to send password setup email",
        description: err.message || "Please try again.",
      });
    }
    
    setIsLoading(false);
  };

  // Signup new user
  const handleSignup = async (data: SignupFormData) => {
    setIsLoading(true);
    
    const { error } = await signUp(data.email, data.password, {
      first_name: data.first_name,
      last_name: data.last_name,
      role: data.role,
      hpcsa_number: data.hpcsa_number,
    });
    
    if (error) {
      if (error.message.includes("already registered")) {
        toast({
          variant: "destructive",
          title: "Account exists",
          description: "An account with this email already exists. Please sign in.",
        });
        setStep('email');
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
        description: "Welcome to Quadcare Telehealth. Redirecting...",
      });
    }
    
    setIsLoading(false);
  };

  const handleRoleChange = (value: string) => {
    setSelectedRole(value as AppRole);
    signupForm.setValue("role", value as "patient" | "nurse" | "doctor" | "receptionist");
  };

  const goBack = () => {
    setStep('email');
    setAccountStatus(null);
    passwordForm.reset();
    setPasswordForm.reset();
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
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>

        {/* Password Reset View */}
        {step === 'password-reset' ? (
          <PasswordReset onBack={() => setStep('email')} />
        ) : step === 'set-password' && accountStatus ? (
          /* Bulk-imported user - Set Password */
          <Card className="border-border/50 shadow-xl">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30">
                  <UserCheck className="w-10 h-10 text-green-600" />
                </div>
              </div>
              <CardTitle className="text-2xl">
                Welcome{accountStatus.first_name ? `, ${accountStatus.first_name}` : ''}!
              </CardTitle>
              <CardDescription className="mt-2 space-y-2">
                <div className="flex items-center justify-center gap-2 text-sm">
                  <Building2 className="w-4 h-4" />
                  <span>Pre-registered by <strong>Campus Africa</strong></span>
                </div>
                <p>Set a password to activate your account.</p>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{email}</span>
              </div>
              
              <form onSubmit={setPasswordForm.handleSubmit(handleSetPassword)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Create Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 8 characters"
                      className="pl-10 pr-10"
                      {...setPasswordForm.register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {setPasswordForm.formState.errors.password && (
                    <p className="text-sm text-destructive">{setPasswordForm.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="confirm-new-password"
                      type="password"
                      placeholder="Confirm your password"
                      className="pl-10"
                      {...setPasswordForm.register("confirm_password")}
                    />
                  </div>
                  {setPasswordForm.formState.errors.confirm_password && (
                    <p className="text-sm text-destructive">{setPasswordForm.formState.errors.confirm_password.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending setup email...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Set Password & Activate
                    </>
                  )}
                </Button>
              </form>

              <p className="text-xs text-center text-muted-foreground">
                We'll send you an email with a secure link to set your password.
              </p>
              
              <button
                type="button"
                onClick={goBack}
                className="w-full text-sm text-muted-foreground hover:text-foreground"
              >
                ← Use a different email
              </button>
            </CardContent>
          </Card>
        ) : step === 'password' ? (
          /* Existing user - Enter Password */
          <Card className="border-border/50 shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Welcome back!</CardTitle>
              <CardDescription>Enter your password to continue</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{email}</span>
                <button
                  type="button"
                  onClick={goBack}
                  className="ml-auto text-primary text-xs hover:underline"
                >
                  Change
                </button>
              </div>
              
              <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10"
                      autoFocus
                      {...passwordForm.register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordForm.formState.errors.password && (
                    <p className="text-sm text-destructive">{passwordForm.formState.errors.password.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>

              <button
                type="button"
                onClick={() => setStep('password-reset')}
                className="w-full text-sm text-primary hover:underline"
              >
                Forgot your password?
              </button>
            </CardContent>
          </Card>
        ) : step === 'signup' ? (
          /* New user - Sign Up */
          <Card className="border-border/50 shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Create your account</CardTitle>
              <CardDescription>Join Quadcare Telehealth for quality healthcare</CardDescription>
            </CardHeader>
            <CardContent>
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
                      className="pl-10 bg-muted/50"
                      readOnly
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
                      placeholder="At least 8 characters"
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

                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={goBack}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  ← Back to login
                </button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Step 1: Email Input */
          <Card className="border-border/50 shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Sign in to Quadcare</CardTitle>
              <CardDescription>
                Enter your email to continue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={emailForm.handleSubmit(handleEmailSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10"
                      autoFocus
                      {...emailForm.register("email")}
                    />
                  </div>
                  {emailForm.formState.errors.email && (
                    <p className="text-sm text-destructive">{emailForm.formState.errors.email.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">New to Quadcare?</span>
                  </div>
                </div>
                
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Enter your email above. If you don't have an account, we'll help you create one.
                </p>
              </div>

              <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                <p className="text-xs text-center text-muted-foreground">
                  <strong>Campus Africa students:</strong> Your account is pre-registered.
                  <br />
                  Just enter your email to get started!
                </p>
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
