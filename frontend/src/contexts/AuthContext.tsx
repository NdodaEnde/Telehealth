import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || '';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  id_number?: string | null;
}

interface PatientProfile {
  id: string;
  user_id: string;
  onboarding_completed_at: string | null;
  has_medical_aid: boolean;
  medical_aid_scheme: string | null;
  // Add other fields as needed
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  patientProfile: PatientProfile | null;
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
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, phone, avatar_url, id_number")
        .eq("id", userId)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // Fetch role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (roleData) {
        setRole(roleData.role);
        
        // Only fetch patient profile if user is a patient
        if (roleData.role === "patient") {
          await fetchPatientProfile(userId);
        } else {
          // Non-patients don't need onboarding
          setOnboardingComplete(true);
        }
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  const fetchPatientProfile = async (userId: string) => {
    try {
      // Check if patient has completed onboarding by checking if id_number is set in profiles
      // Since patient_profiles table doesn't exist, we use profiles.id_number as the indicator
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, phone, avatar_url, id_number, date_of_birth")
        .eq("id", userId)
        .single();

      if (error) {
        console.log("Profile check error:", error.message);
        setPatientProfile(null);
        setOnboardingComplete(false);
        return;
      }

      if (profileData) {
        // Patient is onboarded if they have an ID number set
        const isOnboarded = !!profileData.id_number;
        setPatientProfile({
          id: profileData.id,
          user_id: profileData.id,
          onboarding_completed_at: isOnboarded ? new Date().toISOString() : null,
          has_medical_aid: false, // We can't know this from profiles table
          medical_aid_scheme: null,
        });
        setOnboardingComplete(isOnboarded);
      } else {
        setPatientProfile(null);
        setOnboardingComplete(false);
      }
    } catch (error) {
      console.error("Error fetching patient profile:", error);
      setPatientProfile(null);
      setOnboardingComplete(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Defer data fetching to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setPatientProfile(null);
          setRole(null);
          setOnboardingComplete(false);
        }

        if (event === "SIGNED_OUT") {
          setProfile(null);
          setPatientProfile(null);
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
    setPatientProfile(null);
    setRole(null);
    setOnboardingComplete(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        patientProfile,
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
