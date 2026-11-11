type CashfreeInstance = {
  checkout: (options: {
    paymentSessionId: string;
    redirectTarget?: "_self" | "_blank" | "_top";
  }) => Promise<unknown>;
};

type CashfreeFactory = (options: { mode: "sandbox" | "production" }) => CashfreeInstance;

declare global {
  interface Window {
    Cashfree?: CashfreeFactory;
  }
}

const SCRIPT_URL = "https://sdk.cashfree.com/js/v3/cashfree.js";

export async function loadCashfreeSdk(): Promise<CashfreeFactory> {
  if (typeof window === "undefined") {
    throw new Error("Cashfree SDK requires a browser");
  }
  if (window.Cashfree) return window.Cashfree;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Cashfree SDK")));
      if (window.Cashfree) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Cashfree SDK"));
    document.head.appendChild(script);
  });

  if (!window.Cashfree) {
    throw new Error("Cashfree SDK unavailable");
  }
  return window.Cashfree;
}

export async function openCashfreeCheckout(
  paymentSessionId: string,
  cfEnv: string,
): Promise<void> {
  const Cashfree = await loadCashfreeSdk();
  const mode = cfEnv === "production" ? "production" : "sandbox";
  const cashfree = Cashfree({ mode });
  await cashfree.checkout({
    paymentSessionId,
    redirectTarget: "_self",
  });
}
