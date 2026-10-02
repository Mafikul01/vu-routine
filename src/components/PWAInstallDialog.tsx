import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Download, Smartphone, CheckCircle2, Share2, PlusSquare, Zap, WifiOff } from "lucide-react";

interface PWAInstallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isInstalled: boolean;
  isInstallable: boolean;
  isIOS: boolean;
  onInstall: () => Promise<void>;
  onDismissForever?: () => void;
}

export const PWAInstallDialog: React.FC<PWAInstallDialogProps> = ({
  open,
  onOpenChange,
  isInstalled,
  isInstallable,
  isIOS,
  onInstall,
}) => {
  const handleDismiss = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 overflow-hidden z-[70]">
        <DialogHeader className="text-center pt-2">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 shadow-sm relative overflow-hidden">
            <img
              src="https://i.imgur.com/X13BpyI.png"
              alt="VU Routine"
              className="h-12 w-12 rounded-xl object-cover"
              onError={(e) => {
                // Fallback to icon if image fails to load
                e.currentTarget.style.display = "none";
              }}
            />
            <Smartphone className="h-8 w-8 text-primary absolute" style={{ display: "none" }} />
          </div>

          <DialogTitle className="font-heading text-xl font-bold tracking-tight text-center text-foreground">
            {isInstalled ? "App Already Installed" : "Install VU Routine App"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1 text-center">
            {isInstalled
              ? "This application is already installed on your device as a PWA."
              : "ফোনে ডিরেক্ট অ্যাপ হিসেবে ইনস্টল করুন ও সহজে ব্যবহার করুন"}
          </p>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {isInstalled ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                PWA মোডে সচল রয়েছে
              </p>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 leading-relaxed">
                আপনার ডিভাইসে অ্যাপটি সফলভাবে ইনস্টল করা আছে। আপনি হোমস্ক্রিন থেকে সরাসরি সম্পূর্ণ স্ক্রিনে এটি ব্যবহার করতে পারবেন।
              </p>
            </div>
          ) : (
            <>
              {/* Feature Highlights */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border bg-secondary/50 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <WifiOff className="h-4 w-4 text-primary" />
                    <span>অফলাইন সুবিধা</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    ইন্টারনেট ছাড়াই রুটিন এবং বাস শিডিউল লোড হবে
                  </p>
                </div>
                <div className="rounded-xl border bg-secondary/50 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span>১-ক্লিকে ওপেন</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    কোনো ব্রাউজার ইউআরএল ছাড়াই সরাসরি হোমস্ক্রিনে অ্যাপ
                  </p>
                </div>
              </div>

              {/* iOS Instructions */}
              {isIOS ? (
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 space-y-2 text-xs">
                  <p className="font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                    <Share2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    iPhone / iPad-এ যেভাবে ইনস্টল করবেন:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-blue-800/90 dark:text-blue-300/90">
                    <li>
                      সাফারি (Safari) ব্রাউজারের নিচে <strong>Share বাটন</strong> (<Share2 className="h-3 w-3 inline mx-0.5" />) এ চাপ দিন।
                    </li>
                    <li>
                      নিচে স্ক্রল করে <strong>"Add to Home Screen"</strong> (<PlusSquare className="h-3 w-3 inline mx-0.5" />) অপশন সিলেক্ট করুন।
                    </li>
                    <li>
                      উপরে ডানপাশের <strong>"Add"</strong> বাটনে ক্লিক করলেই অ্যাপ যুক্ত হয়ে যাবে।
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <button
                    onClick={onInstall}
                    className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm transition-all shadow-md active:scale-[0.98]"
                  >
                    <Download className="h-5 w-5" />
                    <span>Install App (ইনস্টল করুন)</span>
                  </button>

                  {!isInstallable && (
                    <div className="rounded-xl border border-muted bg-secondary/30 p-2.5 text-center">
                      <p className="text-[11px] text-muted-foreground">
                        ব্রাউজারে সরাসরি পপআপ না এলে ক্রোম বা ব্রাউজারের উপরে ডানদিকের থ্রি-ডট (<strong>⋮</strong>) মেনু থেকে <strong>"Install app"</strong> বা <strong>"Add to Home screen"</strong> এ চাপ দিন।
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="mt-2 pt-2 border-t flex sm:flex-row flex-col gap-2">
          <button
            onClick={handleDismiss}
            className="w-full rounded-xl border border-input bg-background hover:bg-secondary py-2.5 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            {isInstalled ? "Close" : "Not Now (পরে করব)"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
