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
      richColors
      closeButton
      icons={{
        success: <SuccessIcon />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl",
          success: 
            "group-[.toaster]:border-green-600 group-[.toaster]:bg-green-600 group-[.toaster]:text-white dark:group-[.toaster]:bg-green-700",
          error:
            "group-[.toaster]:border-red-600 group-[.toaster]:bg-red-600 group-[.toaster]:text-white dark:group-[.toaster]:bg-red-700",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
