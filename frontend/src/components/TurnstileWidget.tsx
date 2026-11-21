import { useEffect, useRef, useState } from "react";

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: "light" | "dark" | "auto";
      size?: "normal" | "compact" | "flexible";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let turnstileScriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstileScript(): Promise<TurnstileApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Turnstile requires a browser environment."));
  }
  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }
  if (!turnstileScriptPromise) {
    turnstileScriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        `script[src="${TURNSTILE_SCRIPT_SRC}"]`,
      );
      if (existing) {
        existing.addEventListener("load", () => {
          if (window.turnstile) resolve(window.turnstile);
          else reject(new Error("Turnstile failed to initialize."));
        });
        existing.addEventListener("error", () =>
          reject(new Error("Failed to load Cloudflare Turnstile.")),
        );
        return;
      }

      const script = document.createElement("script");
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.turnstile) resolve(window.turnstile);
        else reject(new Error("Turnstile failed to initialize."));
      };
      script.onerror = () => {
        turnstileScriptPromise = null;
        reject(new Error("Failed to load Cloudflare Turnstile."));
      };
      document.head.appendChild(script);
    });
  }
  return turnstileScriptPromise;
}

interface TurnstileWidgetProps {
  siteKey: string;
  resetKey?: number;
  onToken: (token: string | null) => void;
  className?: string;
}

export function TurnstileWidget({
  siteKey,
  resetKey = 0,
  onToken,
  className,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    setLoadError(null);

    loadTurnstileScript()
      .then((api) => {
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = "";
        widgetIdRef.current = api.render(containerRef.current, {
          sitekey: siteKey,
          theme: "dark",
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error
              ? err.message
              : "Could not load CAPTCHA widget.",
          );
          onTokenRef.current(null);
        }
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Ignore cleanup errors if DOM node already detached.
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetKey === 0) return;
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {
        // Ignore if widget is not yet mounted.
      }
    }
    onTokenRef.current(null);
  }, [resetKey]);

  if (loadError) {
    return (
      <p className="text-xs text-red-600">
        {loadError} Please check your network connection and reload.
      </p>
    );
  }

  return <div ref={containerRef} className={className} />;
}
