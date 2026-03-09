"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignInForm({ locale }: { locale: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("demo@example.com");
  const [code, setCode] = useState("");
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [step, setStep] = useState<"request" | "verify">("request");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestOtp() {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/auth/request-otp", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ email })
    });

    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(payload.error?.message ?? "Unable to request OTP");
      return;
    }

    setPreviewCode(payload.otpPreview ?? null);
    setStep("verify");
  }

  async function handleVerifyOtp() {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ email, code })
    });

    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(payload.error?.message ?? "Unable to verify OTP");
      return;
    }

    router.push(`/${locale}/search/units`);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium text-stone-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-900 outline-none focus:border-stone-950"
        />
      </div>

      {step === "verify" ? (
        <div className="space-y-2">
          <label className="text-sm font-medium text-stone-700" htmlFor="otp">
            One-time code
          </label>
          <input
            id="otp"
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-900 outline-none focus:border-stone-950"
          />
          {previewCode ? (
            <p className="text-sm text-stone-500">
              Dev OTP preview: <span className="font-semibold text-stone-900">{previewCode}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        {step === "request" ? (
          <button
            type="button"
            onClick={handleRequestOtp}
            disabled={loading}
            className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Sending..." : "Request OTP"}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleVerifyOtp}
              disabled={loading}
              className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify and continue"}
            </button>
            <button
              type="button"
              onClick={() => setStep("request")}
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700"
            >
              Change email
            </button>
          </>
        )}
      </div>
    </div>
  );
}
