"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

    router.push(`/${locale}/alerts`);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="text-lg font-semibold text-[var(--jinka-text)]">Sign in</div>
        <p className="mt-1 text-sm text-[var(--jinka-muted)]">Use your email to activate alerts and receive matching announcements.</p>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-stone-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] px-4 py-3 text-[var(--jinka-text)] outline-none transition focus:border-[var(--jinka-accent)]"
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
            className="w-full border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] px-4 py-3 text-[var(--jinka-text)] outline-none transition focus:border-[var(--jinka-accent)]"
          />
          {previewCode ? (
            <p className="rounded-[18px] bg-[var(--jinka-accent-soft)] px-3 py-2 text-sm text-[var(--jinka-text)]">
              Dev OTP preview: <span className="font-semibold">{previewCode}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="rounded-[18px] bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/api/auth/google/start?locale=${locale}&returnTo=/${locale}/alerts`}
          className="rounded-full border border-[var(--jinka-border)] bg-[var(--jinka-surface)] px-5 py-3 text-sm font-semibold text-[var(--jinka-text)]"
        >
          Continue with Google
        </Link>
        {step === "request" ? (
          <button
            type="button"
            onClick={handleRequestOtp}
            disabled={loading}
            className="rounded-full bg-[var(--jinka-accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Sending..." : "Request OTP"}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleVerifyOtp}
              disabled={loading}
              className="rounded-full bg-[var(--jinka-accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify and continue"}
            </button>
            <button
              type="button"
              onClick={() => setStep("request")}
              className="rounded-full border border-[var(--jinka-border)] bg-[var(--jinka-surface)] px-5 py-3 text-sm font-semibold text-[var(--jinka-text)]"
            >
              Change email
            </button>
          </>
        )}
      </div>
    </div>
  );
}
