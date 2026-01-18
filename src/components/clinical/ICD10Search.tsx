import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, X, Plus } from "lucide-react";

// Common ICD-10 codes for telehealth consultations
const COMMON_ICD10_CODES = [
  { code: "J06.9", description: "Acute upper respiratory infection, unspecified" },
  { code: "J00", description: "Acute nasopharyngitis (common cold)" },
  { code: "J02.9", description: "Acute pharyngitis, unspecified" },
  { code: "J03.90", description: "Acute tonsillitis, unspecified" },
  { code: "J20.9", description: "Acute bronchitis, unspecified" },
  { code: "N39.0", description: "Urinary tract infection, site not specified" },
  { code: "K30", description: "Functional dyspepsia" },
  { code: "R51", description: "Headache" },
  { code: "M54.5", description: "Low back pain" },
  { code: "L30.9", description: "Dermatitis, unspecified" },
  { code: "R05", description: "Cough" },
  { code: "R50.9", description: "Fever, unspecified" },
  { code: "R11.2", description: "Nausea with vomiting, unspecified" },
  { code: "K59.00", description: "Constipation, unspecified" },
  { code: "R42", description: "Dizziness and giddiness" },
  { code: "H10.9", description: "Conjunctivitis, unspecified" },
  { code: "H66.90", description: "Otitis media, unspecified" },
  { code: "B34.9", description: "Viral infection, unspecified" },
  { code: "F41.9", description: "Anxiety disorder, unspecified" },
  { code: "F32.9", description: "Major depressive disorder, single episode" },
  { code: "I10", description: "Essential (primary) hypertension" },
  { code: "E11.9", description: "Type 2 diabetes mellitus without complications" },
  { code: "Z00.00", description: "General adult medical examination" },
  { code: "Z71.1", description: "Person with feared health complaint" },
];

interface ICD10Code {
  code: string;
  description: string;
}

interface ICD10SearchProps {
  selectedCodes: ICD10Code[];
  onCodesChange: (codes: ICD10Code[]) => void;
}

export const ICD10Search = ({ selectedCodes, onCodesChange }: ICD10SearchProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  const filteredCodes = COMMON_ICD10_CODES.filter(
    (item) =>
      !selectedCodes.some((selected) => selected.code === item.code) &&
      (item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const addCode = useCallback(
    (code: ICD10Code) => {
      onCodesChange([...selectedCodes, code]);
      setSearchQuery("");
      setShowResults(false);
    },
    [selectedCodes, onCodesChange]
  );

  const removeCode = useCallback(
    (codeToRemove: string) => {
      onCodesChange(selectedCodes.filter((c) => c.code !== codeToRemove));
    },
    [selectedCodes, onCodesChange]
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search ICD-10 codes..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          className="pl-10"
        />
        {showResults && searchQuery && (
          <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg">
            <ScrollArea className="max-h-48">
              {filteredCodes.length > 0 ? (
                filteredCodes.slice(0, 10).map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-muted flex items-center justify-between"
                    onClick={() => addCode(item)}
                  >
                    <div>
                      <span className="font-mono font-medium text-primary">{item.code}</span>
                      <span className="text-sm text-muted-foreground ml-2">{item.description}</span>
                    </div>
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-muted-foreground">No matching codes found</div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Common codes quick select */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Quick add common codes:</p>
        <div className="flex flex-wrap gap-1">
          {COMMON_ICD10_CODES.slice(0, 8)
            .filter((c) => !selectedCodes.some((s) => s.code === c.code))
            .map((item) => (
              <Button
                key={item.code}
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => addCode(item)}
              >
                {item.code}
              </Button>
            ))}
        </div>
      </div>

      {/* Selected codes */}
      {selectedCodes.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Selected diagnoses:</p>
          <div className="space-y-1">
            {selectedCodes.map((item) => (
              <div
                key={item.code}
                className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-md px-3 py-2"
              >
                <div>
                  <Badge variant="secondary" className="font-mono mr-2">
                    {item.code}
                  </Badge>
                  <span className="text-sm">{item.description}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCode(item.code)}
                  className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
