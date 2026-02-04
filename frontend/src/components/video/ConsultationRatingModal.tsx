import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { ratingsAPI } from "@/lib/api";
import { toast } from "sonner";

interface ConsultationRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  clinicianName: string;
}

export const ConsultationRatingModal = ({
  isOpen,
  onClose,
  appointmentId,
  clinicianName,
}: ConsultationRatingModalProps) => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const ratingLabels: Record<number, string> = {
    1: "Poor",
    2: "Fair",
    3: "Good",
    4: "Very Good",
    5: "Excellent",
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await ratingsAPI.submit({
        appointment_id: appointmentId,
        rating,
        feedback: feedback.trim() || undefined,
      });

      if (response?.success) {
        setIsSubmitted(true);
        toast.success("Thank you for your feedback!");
        // Auto-close after 2 seconds
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      console.error("Rating submission error:", err);
      toast.error(err.message || "Failed to submit rating");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    toast.info("You can rate this consultation later from your dashboard");
    onClose();
  };

  if (isSubmitted) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Thank You!</h3>
            <p className="text-muted-foreground text-center">
              Your feedback helps us improve our services.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            How was your consultation?
          </DialogTitle>
          <DialogDescription className="text-center">
            Rate your experience with {clinicianName}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {/* Star Rating */}
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="p-1 transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star
                    className={`w-10 h-10 transition-colors ${
                      star <= (hoveredRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            
            {/* Rating Label */}
            <div className="h-6">
              {(hoveredRating || rating) > 0 && (
                <span className="text-sm font-medium text-muted-foreground">
                  {ratingLabels[hoveredRating || rating]}
                </span>
              )}
            </div>
          </div>

          {/* Feedback Textarea */}
          <div className="mt-6 space-y-2">
            <Label htmlFor="feedback" className="text-sm text-muted-foreground">
              Additional feedback (optional)
            </Label>
            <Textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us about your experience..."
              className="resize-none"
              rows={3}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {feedback.length}/1000
            </p>
          </div>

          {/* Privacy Note */}
          <p className="text-xs text-center text-muted-foreground mt-4">
            🔒 Your feedback is anonymous and helps us improve our services.
          </p>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleSkip} disabled={isSubmitting}>
            Skip
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || rating === 0}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Rating"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConsultationRatingModal;
