import { useState, useEffect, useCallback } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const checkIsInstalled = useCallback((): boolean => {
    if (typeof window === "undefined") return false;

    // Check standalone mode in CSS media queries
    const isStandaloneMQ = window.matchMedia("(display-mode: standalone)").matches;
    const isFullscreenMQ = window.matchMedia("(display-mode: fullscreen)").matches;
    const isMinimalUIMQ = window.matchMedia("(display-mode: minimal-ui)").matches;

    // iOS Safari standalone property
    const isIOSStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    // Android Trusted Web Activity / referrer
    const isAndroidApp = document.referrer.startsWith("android-app://");

    // Local storage persistence
    const storedInstalled = localStorage.getItem("pwa-is-installed") === "true";

    return isStandaloneMQ || isFullscreenMQ || isMinimalUIMQ || isIOSStandalone || isAndroidApp || storedInstalled;
  }, []);

  useEffect(() => {
    setIsInstalled(checkIsInstalled());

    // Check iOS user agent
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(isIOSDevice);

    // Watch for media query change to standalone
    const mq = window.matchMedia("(display-mode: standalone)");
    const handleMQChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        localStorage.setItem("pwa-is-installed", "true");
      }
    };

    if (mq.addEventListener) {
      mq.addEventListener("change", handleMQChange);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      localStorage.setItem("pwa-is-installed", "true");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener("change", handleMQChange);
      }
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [checkIsInstalled]);

  const promptInstall = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferredPrompt) {
      return "unavailable";
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
        localStorage.setItem("pwa-is-installed", "true");
        setDeferredPrompt(null);
        return "accepted";
      }
      return "dismissed";
    } catch (err) {
      console.error("PWA install prompt error:", err);
      return "unavailable";
    }
  }, [deferredPrompt]);

  return {
    deferredPrompt,
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    promptInstall,
  };
}
