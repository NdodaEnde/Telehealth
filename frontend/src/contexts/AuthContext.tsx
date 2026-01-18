import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  id_number?: string | null;
  date_of_birth?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  isLoading: boolean;
  onboardingComplete: boolean;
  signUp: (email: string, password: string, metadata: SignUpMetadata) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

interface SignUpMetadata {
  first_name: string;
  last_name: string;
  role?: AppRole;
  hpcsa_number?: string;
  id_number?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  const fetchUserData = async (userId: string) => {
    console.log("[AuthContext] Fetching user data for:", userId);
    try {
      // Fetch profile with all fields including id_number
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, phone, avatar_url, id_number, date_of_birth")
        .eq("id", userId)
        .single();

      if (profileError) {
        console.error("[AuthContext] Profile fetch error:", profileError);
      }

      if (profileData) {
        console.log("[AuthContext] Profile data:", profileData);
        console.log("[AuthContext] id_number value:", profileData.id_number);
        setProfile(profileData);
      }

      // Fetch role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (roleError) {
        console.error("[AuthContext] Role fetch error:", roleError);
      }

      if (roleData) {
        console.log("[AuthContext] Role:", roleData.role);
        setRole(roleData.role);
        
        // Check onboarding status based on role
        if (roleData.role === "patient") {
          // Patient is onboarded if they have an ID number set
          const isOnboarded = !!(profileData?.id_number);
          console.log("[AuthContext] Is patient onboarded:", isOnboarded);
          setOnboardingComplete(isOnboarded);
        } else {
          // Non-patients (nurse, doctor, admin) don't need onboarding
          console.log("[AuthContext] Non-patient role, marking as onboarded");
          setOnboardingComplete(true);
        }
      }
    } catch (error) {
      console.error("[AuthContext] Error fetching user data:", error);
    }
  };

  const refreshProfile = async () => {
    console.log("[AuthContext] Refreshing profile...");
    if (user) {
      // Force a fresh fetch by clearing state first
      await fetchUserData(user.id);
      console.log("[AuthContext] Profile refreshed, onboardingComplete:", onboardingComplete);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("[AuthContext] Auth state changed:", event);
        setSession(session);
        setUser(session?.user ?? null);

        // Defer data fetching to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
          setOnboardingComplete(false);
        }

        if (event === "SIGNED_OUT") {
          setProfile(null);
          setRole(null);
          setOnboardingComplete(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, metadata: SignUpMetadata) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: metadata.first_name,
          last_name: metadata.last_name,
          role: metadata.role || "patient",
          hpcsa_number: metadata.hpcsa_number,
          id_number: metadata.id_number,
        },
      },
    });

    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setOnboardingComplete(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isLoading,
        onboardingComplete,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
