import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, ChevronLeft, X, Sparkles } from "lucide-react";

interface Step {
  id: string;
  target: string;
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right" | "auto";
  actionBefore?: () => void;
  actionAfter?: () => void;
}

interface GuidedTourProps {
  onComplete: () => void;
  onOpenMenu: (open: boolean) => void;
  isMenuOpen: boolean;
}

export function GuidedTour({ onComplete, onOpenMenu, isMenuOpen }: GuidedTourProps) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const observerRef = useRef<ResizeObserver | null>(null);

  const steps: Step[] = [
    {
      id: "day-picker",
      target: "#tour-day-picker-container",
      title: "📅 Day & Date Picker",
      description: "This is your main schedule selector. Standard tabs show current week routines. Turn on 'Show upcoming dates' to scroll and explore routines up to 60 days ahead!",
      position: "bottom",
    },
    {
      id: "switch-role",
      target: "#tour-switch-role",
      title: "🔄 Switch Role",
      description: "Want to lookup teacher timetables or verify another student's routine? Easily jump back and forth by clicking Switch.",
      position: "bottom",
    },
    {
      id: "room-finder",
      target: "#tour-room-finder",
      title: "📍 Room Finder",
      description: "Looking for empty classrooms or want to see a room's daily timeline? Jump directly into our real-time Dynamic Room Finder.",
      position: "bottom",
    },
    {
      id: "menu-bar",
      target: "#tour-menu-button",
      title: "🍔 Main Menu Options",
      description: "Click here to access extra resources: VU bus schedules, the complete teacher directory, and developer contacts.",
      position: "bottom",
      actionAfter: () => {
        // Open menu programmatically for the next step
        onOpenMenu(true);
      },
    },
    {
      id: "dark-mode",
      target: "#tour-dark-mode",
      title: "🌙 Theme Settings",
      description: "Choose between light mode or battery-saving dark mode. Toggle it instantly right inside the menu bar.",
      position: "left",
      actionBefore: () => {
        // Make sure menu is open
        onOpenMenu(true);
      },
      actionAfter: () => {
        // Close menu
        onOpenMenu(false);
      }
    },
    {
      id: "ai-chat",
      target: "#tour-ai-chat-btn",
      title: "✨ AI Assistant Chat",
      description: "Ask questions, find free classrooms, or ask about teacher schedules! Tap your AI Companion at any time.",
      position: "top",
    }
  ];

  const currentStep = steps[currentStepIdx];

  // Function to update coordinates of current target
  const updateCoords = useCallback(() => {
    if (!currentStep) return;
    const element = document.querySelector(currentStep.target);
    if (element) {
      const rect = element.getBoundingClientRect();
      setCoords({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      });
      setIsVisible(true);
    } else {
      setCoords(null);
      setIsVisible(false);
    }
  }, [currentStep]);

  // Run before/after actions
  useEffect(() => {
    if (!currentStep) return;
    
    // Execute actionBefore if specified
    if (currentStep.actionBefore) {
      currentStep.actionBefore();
    }

    // Delay calculation slightly to allow layout shifts (e.g. menu opening)
    const timer = setTimeout(() => {
      // Auto-scroll target into view if needed
      const element = document.querySelector(currentStep.target);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
      
      updateCoords();
    }, 150);

    return () => clearTimeout(timer);
  }, [currentStepIdx, currentStep, updateCoords]);

  // Keep coordinates updated on scroll, resize, or layout changes
  useEffect(() => {
    window.addEventListener("resize", updateCoords);
    window.addEventListener("scroll", updateCoords);
    
    // Observe DOM changes to recalculate if things move
    const observer = new MutationObserver(updateCoords);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("resize", updateCoords);
      window.removeEventListener("scroll", updateCoords);
      observer.disconnect();
    };
  }, [updateCoords]);

  const handleNext = () => {
    if (currentStep && currentStep.actionAfter) {
      currentStep.actionAfter();
    }

    if (currentStepIdx < steps.length - 1) {
      setCurrentStepIdx(currentStepIdx + 1);
    } else {
      localStorage.setItem("routine-tour-completed", "true");
      onComplete();
    }
  };

  const handleBack = () => {
    // If we're on dark mode step, and we go back to menu, close menu beforehand
    if (currentStep.id === "dark-mode") {
      onOpenMenu(false);
    }
    
    if (currentStepIdx > 0) {
      setCurrentStepIdx(currentStepIdx - 1);
    }
  };

  const handleSkip = () => {
    // Ensure menu is closed if skip is clicked on dark-mode
    onOpenMenu(false);
    localStorage.setItem("routine-tour-completed", "true");
    onComplete();
  };

  if (!coords || !isVisible) return null;

  // Calculate where to place the tooltip
  const getTooltipPosition = () => {
    const isMobile = window.innerWidth < 640;
    if (isMobile) {
      const centerY = coords.top - window.scrollY + coords.height / 2;
      const isTargetInBottomHalf = centerY > window.innerHeight / 2;
      if (isTargetInBottomHalf) {
        return {
          top: "24px",
          left: "50%",
          transform: "translateX(-50%)",
        };
      } else {
        return {
          bottom: "24px",
          left: "50%",
          transform: "translateX(-50%)",
        };
      }
    }

    const spaceBelow = window.innerHeight - (coords.top - window.scrollY + coords.height);
    const spaceAbove = coords.top - window.scrollY;
    
    let placement = currentStep.position;
    if (placement === "auto") {
      placement = spaceBelow > 220 ? "bottom" : "top";
    }

    const margin = 12;

    switch (placement) {
      case "top":
        return {
          top: coords.top - margin,
          left: Math.min(Math.max(coords.left + coords.width / 2, 160), window.innerWidth - 160),
          transform: "translate(-50%, -100%)",
        };
      case "left":
        return {
          top: coords.top + coords.height / 2,
          left: coords.left - margin,
          transform: "translate(-100%, -50%)",
        };
      case "right":
        return {
          top: coords.top + coords.height / 2,
          left: coords.left + coords.width + margin,
          transform: "translate(0, -50%)",
        };
      case "bottom":
      default:
        return {
          top: coords.top + coords.height + margin,
          left: Math.min(Math.max(coords.left + coords.width / 2, 160), window.innerWidth - 160),
          transform: "translate(-50%, 0)",
        };
    }
  };

  const tooltipStyle = getTooltipPosition();

  return (
    <div className="fixed inset-0 z-[20000] pointer-events-none overflow-hidden font-sans">
      {/* Semi-transparent dark overlay */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-[1px] pointer-events-auto"
        onClick={handleSkip}
      />

      {/* Spotlight highlight overlay */}
      <motion.div
        className="absolute border-2 border-primary bg-transparent rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] z-[20001] pointer-events-none transition-all duration-300"
        animate={{
          top: coords.top - 6,
          left: coords.left - 6,
          width: coords.width + 12,
          height: coords.height + 12,
        }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
      />

      {/* Floating Tour Dialog Box */}
      <div
        className="absolute z-[20002] pointer-events-auto w-[calc(100vw-32px)] max-w-sm"
        style={tooltipStyle}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          className="bg-card text-card-foreground p-5 rounded-2xl border shadow-xl flex flex-col gap-4 relative"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-primary bg-primary/10 px-2.5 py-1 rounded-full flex items-center gap-1">
              <Sparkles className="h-3 w-3 fill-primary/20" />
              Quick Guide • {currentStepIdx + 1} of {steps.length}
            </span>
            <button
              onClick={handleSkip}
              className="text-muted-foreground hover:text-foreground hover:bg-muted p-1 rounded-full transition-colors"
              title="Skip Tour"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Text details */}
          <div className="space-y-1.5">
            <h3 className="font-heading font-bold text-base text-foreground leading-tight">
              {currentStep.title}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {currentStep.description}
            </p>
          </div>

          {/* Footer controls */}
          <div className="flex items-center justify-between pt-1 border-t border-muted/50">
            <button
              onClick={handleSkip}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip visit
            </button>
            <div className="flex items-center gap-2">
              {currentStepIdx > 0 && (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 text-xs font-semibold text-foreground border hover:bg-muted px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex items-center gap-1 text-xs font-bold text-primary-foreground bg-primary hover:opacity-90 px-3 py-1.5 rounded-lg shadow-sm transition-all active:scale-[0.98]"
              >
                {currentStepIdx === steps.length - 1 ? "Finish" : "Next"}
                {currentStepIdx < steps.length - 1 && <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
