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
import { Eye, EyeOff, Mail, Lock, User, Phone, Shield } from "lucide-react";
import { PasswordReset } from "@/components/auth/PasswordReset";
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
  role: z.enum(["patient", "nurse", "doctor"] as const),
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
        description: "Welcome to HCF Telehealth. Redirecting to your dashboard...",
      });
    }
  };

  const handleRoleChange = (value: string) => {
    setSelectedRole(value as AppRole);
    signupForm.setValue("role", value as "patient" | "nurse" | "doctor");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
              <span className="text-primary-foreground font-bold text-xl">H</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xl text-foreground leading-tight">HCF</span>
              <span className="text-sm text-muted-foreground leading-tight">Telehealth</span>
            </div>
          </div>
        </div>

        {/* Password Reset View */}
        {showPasswordReset ? (
          <PasswordReset onBack={() => setShowPasswordReset(false)} />
        ) : (
        <Card className="border-border/50 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {isLogin ? "Welcome back" : "Create your account"}
            </CardTitle>
            <CardDescription>
              {isLogin
                ? "Sign in to access your healthcare portal"
                : "Join HCF Telehealth for quality healthcare"}
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
