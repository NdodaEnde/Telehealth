import { useState, useEffect } from "react";
import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from "react-joyride";
import { useAuth } from "@/contexts/AuthContext";

interface PatientGuidedTourProps {
  onComplete?: () => void;
}

export const PatientGuidedTour = ({ onComplete }: PatientGuidedTourProps) => {
  const { user } = useAuth();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Check if user has completed the tour
  useEffect(() => {
    if (!user) return;
    
    const tourKey = `quadcare_patient_tour_completed_${user.id}`;
    const hasCompletedTour = localStorage.getItem(tourKey);
    
    if (!hasCompletedTour) {
      // Small delay to let the UI render first
      const timer = setTimeout(() => {
        setRun(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const steps: Step[] = [
    {
      target: "body",
      content: (
        <div className="text-center">
          <h3 className="text-lg font-bold mb-2">Welcome to Quadcare! 👋</h3>
          <p className="text-sm text-gray-600">
            Let us show you around your patient dashboard. This quick tour will help you get started.
          </p>
        </div>
      ),
      placement: "center",
      disableBeacon: true,
    },
    {
      target: '[data-tour="chat-tab"]',
      content: (
        <div>
          <h4 className="font-semibold mb-2">💬 Chat with Reception</h4>
          <p className="text-sm text-gray-600">
            This is where you can start a conversation with our reception team to book appointments, ask questions, or get help.
          </p>
        </div>
      ),
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: '[data-tour="new-chat-button"]',
      content: (
        <div>
          <h4 className="font-semibold mb-2">🆕 Start a New Chat</h4>
          <p className="text-sm text-gray-600">
            Click this button to start a new conversation. Tell us what you need - whether it's booking a consultation, getting a script, or asking a question.
          </p>
        </div>
      ),
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: '[data-tour="consultations-tab"]',
      content: (
        <div>
          <h4 className="font-semibold mb-2">📅 Your Consultations</h4>
          <p className="text-sm text-gray-600">
            View your upcoming and past video consultations here. When it's time for your appointment, click "Join" to start the video call.
          </p>
        </div>
      ),
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: '[data-tour="profile-tab"]',
      content: (
        <div>
          <h4 className="font-semibold mb-2">👤 Your Profile</h4>
          <p className="text-sm text-gray-600">
            Keep your personal information and medical details up to date. This helps us provide better care.
          </p>
        </div>
      ),
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: "body",
      content: (
        <div className="text-center">
          <h3 className="text-lg font-bold mb-2">You're All Set! 🎉</h3>
          <p className="text-sm text-gray-600 mb-3">
            Ready to book your first consultation? Start by clicking <strong>"New Chat"</strong> and tell us how we can help.
          </p>
          <p className="text-xs text-gray-400">
            You can always access help from the menu if you need it.
          </p>
        </div>
      ),
      placement: "center",
      disableBeacon: true,
    },
  ];

  const handleCallback = (data: CallBackProps) => {
    const { status, action, index, type } = data;
    
    // Handle step navigation
    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
    }

    // Handle tour completion
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      
      // Mark tour as completed
      if (user) {
        const tourKey = `quadcare_patient_tour_completed_${user.id}`;
        localStorage.setItem(tourKey, "true");
      }
      
      onComplete?.();
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous
      showProgress
      showSkipButton
      hideCloseButton={false}
      scrollToFirstStep
      spotlightClicks
      disableOverlayClose
      callback={handleCallback}
      locale={{
        back: "Back",
        close: "Close",
        last: "Get Started!",
        next: "Next",
        skip: "Skip Tour",
      }}
      styles={{
        options: {
          primaryColor: "#2563eb",
          zIndex: 10000,
          arrowColor: "#fff",
          backgroundColor: "#fff",
          textColor: "#333",
          overlayColor: "rgba(0, 0, 0, 0.6)",
        },
        spotlight: {
          borderRadius: 8,
        },
        tooltip: {
          borderRadius: 12,
          padding: 20,
        },
        tooltipContent: {
          padding: "10px 0",
        },
        buttonNext: {
          backgroundColor: "#2563eb",
          borderRadius: 8,
          padding: "10px 20px",
          fontSize: 14,
          fontWeight: 600,
        },
        buttonBack: {
          color: "#666",
          marginRight: 10,
          fontSize: 14,
        },
        buttonSkip: {
          color: "#999",
          fontSize: 13,
        },
        buttonClose: {
          display: "none",
        },
      }}
      floaterProps={{
        styles: {
          floater: {
            filter: "drop-shadow(0 4px 20px rgba(0, 0, 0, 0.15))",
          },
        },
      }}
    />
  );
};

export default PatientGuidedTour;
