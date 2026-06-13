import { useTheme } from "@/components/ThemeContext";
import { Toaster as Sonner, toast } from "sonner";
import { Check } from "lucide-react";
import { motion } from "motion/react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const SuccessIcon = () => (
  <motion.div
    initial={{ scale: 0.5, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ duration: 0.3, ease: "easeOut" }}
    className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white"
  >
    <Check className="h-3 w-3 stroke-[3]" />
  </motion.div>
);

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton
      icons={{
        success: <SuccessIcon />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background/60 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-foreground group-[.toaster]:border-border/50 group-[.toaster]:shadow-2xl group-[.toaster]:rounded-2xl font-medium",
          success: 
            "group-[.toast]:border-green-500/30 group-[.toast]:bg-green-500/15 group-[.toast]:backdrop-blur-xl group-[.toast]:text-green-800 dark:group-[.toast]:text-green-100 dark:group-[.toast]:bg-green-900/40",
          error:
            "group-[.toast]:border-red-500/30 group-[.toast]:bg-red-500/15 group-[.toast]:backdrop-blur-xl group-[.toast]:text-red-800 dark:group-[.toast]:text-red-100 dark:group-[.toast]:bg-red-900/40",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-xl font-medium",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-xl font-medium",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
