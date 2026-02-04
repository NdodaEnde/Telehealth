import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SelfieCapture } from "./SelfieCapture";
import { profilePhotoAPI } from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface FirstLoginPhotoPromptProps {
  isOpen: boolean;
  onComplete: () => void;
  userName?: string;
}

export const FirstLoginPhotoPrompt = ({
  isOpen,
  onComplete,
  userName = "there"
}: FirstLoginPhotoPromptProps) => {
  const [isUploading, setIsUploading] = useState(false);

  const handleCapture = async (imageData: string) => {
    setIsUploading(true);
    try {
      const response = await profilePhotoAPI.upload(imageData);
      if (response?.success) {
        toast.success("Profile photo saved! Thank you for verifying your identity.");
        onComplete();
      } else {
        toast.error("Failed to save photo. Please try again.");
      }
    } catch (err: any) {
      console.error("Photo upload error:", err);
      toast.error(err.message || "Failed to upload photo");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-xl">
            Welcome, {userName}! 👋
          </DialogTitle>
          <DialogDescription>
            Before you continue, please take a quick selfie. This helps us verify your identity during consultations and protects your healthcare benefits.
          </DialogDescription>
        </DialogHeader>

        {isUploading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Saving your photo...</p>
          </div>
        ) : (
          <SelfieCapture
            onCapture={handleCapture}
            required={true}
            title="Verification Photo"
            description="Take a clear photo of your face. This will be shown to healthcare providers during your consultations."
          />
        )}

        <p className="text-xs text-center text-muted-foreground mt-2">
          Your photo is stored securely and only visible to Quadcare healthcare staff.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default FirstLoginPhotoPrompt;
