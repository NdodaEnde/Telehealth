import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Star, Clock, User, Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Clinician {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  specialization: string | null;
  qualification: string | null;
  years_experience: number | null;
  bio: string | null;
}

interface ClinicianSelectorProps {
  recommendedSpecialization: string | null;
  onSelect: (clinician: Clinician) => void;
  onBack: () => void;
}

export const ClinicianSelector = ({
  recommendedSpecialization,
  onSelect,
  onBack,
}: ClinicianSelectorProps) => {
  const [clinicians, setClinicians] = useState<Clinician[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchClinicians = async () => {
      try {
        const { data: clinicianProfiles, error } = await supabase
          .from("clinician_profiles")
          .select("id, specialization, qualification, years_experience, bio, is_available")
          .eq("is_available", true);

        if (error) throw error;

        if (clinicianProfiles && clinicianProfiles.length > 0) {
          const clinicianIds = clinicianProfiles.map(c => c.id);
          
          const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, avatar_url")
            .in("id", clinicianIds);

          if (profilesError) throw profilesError;

          const merged = clinicianProfiles.map(cp => {
            const profile = profiles?.find(p => p.id === cp.id);
            return {
              id: cp.id,
              first_name: profile?.first_name || "Unknown",
              last_name: profile?.last_name || "",
              avatar_url: profile?.avatar_url || null,
              specialization: cp.specialization,
              qualification: cp.qualification,
              years_experience: cp.years_experience,
              bio: cp.bio,
            };
          });

          setClinicians(merged);
        }
      } catch (error) {
        console.error("Error fetching clinicians:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClinicians();
  }, []);

  const handleContinue = () => {
    const selected = clinicians.find(c => c.id === selectedId);
    if (selected) {
      onSelect(selected);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-4 p-6">
              <Skeleton className="w-16 h-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (clinicians.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No Clinicians Available</h3>
          <p className="text-muted-foreground mb-4">
            There are currently no clinicians available for booking.
          </p>
          <Button variant="outline" onClick={onBack}>
            Go Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {recommendedSpecialization && (
        <div className="flex items-center gap-2 p-4 bg-primary/5 rounded-lg border border-primary/20">
          <Stethoscope className="w-5 h-5 text-primary" />
          <span className="text-sm">
            Based on your symptoms, we recommend a <strong>{recommendedSpecialization}</strong> specialist.
          </span>
        </div>
      )}

      <div className="space-y-4">
        {clinicians.map((clinician) => (
          <Card
            key={clinician.id}
            className={`cursor-pointer transition-all ${
              selectedId === clinician.id
                ? "border-primary ring-2 ring-primary/20"
                : "hover:border-primary/50"
            }`}
            onClick={() => setSelectedId(clinician.id)}
          >
            <CardContent className="flex items-start gap-4 p-6">
              <Avatar className="w-16 h-16">
                <AvatarImage src={clinician.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-lg">
                  {clinician.first_name[0]}{clinician.last_name[0]}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">
                      Dr. {clinician.first_name} {clinician.last_name}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {clinician.qualification || "Medical Professional"}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {clinician.specialization || "General Practice"}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  {clinician.years_experience && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {clinician.years_experience} years exp.
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-warning" />
                    4.8 (120 reviews)
                  </span>
                </div>

                {clinician.bio && (
                  <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                    {clinician.bio}
                  </p>
                )}
              </div>

              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                selectedId === clinician.id
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/30"
              }`}>
                {selectedId === clinician.id && (
                  <div className="w-2 h-2 bg-white rounded-full" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleContinue} disabled={!selectedId}>
          Continue to Select Time
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};
