"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

export function PushSubscriptionManager({
  enableLabel,
  disableLabel,
  connectedLabel,
  disconnectedLabel,
  unsupportedLabel
}: {
  enableLabel: string;
  disableLabel: string;
  connectedLabel: string;
  disconnectedLabel: string;
  unsupportedLabel: string;
}) {
  const [supported, setSupported] = useState(true);
  const [connected, setConnected] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        "PushManager" in window &&
        typeof navigator.serviceWorker?.register === "function" &&
        typeof navigator.serviceWorker?.getRegistration === "function"
    );
  }, []);

  useEffect(() => {
    if (!supported || !navigator.serviceWorker?.getRegistration) {
      return;
    }

    void navigator.serviceWorker.getRegistration("/push-sw.js").then((registration) => {
      void registration?.pushManager.getSubscription().then((subscription) => {
        setConnected(Boolean(subscription));
      });
    });
  }, [supported]);

  async function enablePush() {
    setWorking(true);
    setMessage(null);

    try {
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setMessage(disconnectedLabel);
        setWorking(false);
        return;
      }

      const registration = await navigator.serviceWorker.register("/push-sw.js");
      const keyResponse = await fetch("/api/push-subscriptions/public-key");
      const keyPayload = (await keyResponse.json()) as { publicKey?: string; error?: { message?: string } };

      if (!keyResponse.ok || !keyPayload.publicKey) {
        throw new Error(keyPayload.error?.message ?? "Missing web push public key");
      }

      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyPayload.publicKey)
        }));

      const keys = subscription.toJSON().keys;
      const response = await fetch("/api/push-subscriptions", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          p256dhKey: keys?.p256dh,
          authKey: keys?.auth,
          platform: navigator.userAgent
        })
      });

      if (!response.ok) {
        throw new Error("Unable to save browser push subscription");
      }

      setConnected(true);
      setMessage(connectedLabel);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function disablePush() {
    setWorking(true);
    setMessage(null);

    try {
      const registration = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        await fetch("/api/push-subscriptions", {
          method: "DELETE",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint
          })
        });
        await subscription.unsubscribe();
      }

      setConnected(false);
      setMessage(disconnectedLabel);
    } finally {
      setWorking(false);
    }
  }

  if (!supported) {
    return <p className="text-sm text-[var(--jinka-muted)]">{unsupportedLabel}</p>;
  }

  return (
    <div className="space-y-4 rounded-[24px] border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] p-4">
      <div>
        <div className="text-lg font-semibold text-[var(--jinka-text)]">Browser push</div>
        <div className="mt-1 text-sm text-[var(--jinka-muted)]">{connected ? connectedLabel : disconnectedLabel}</div>
      </div>
      <button
        type="button"
        onClick={connected ? disablePush : enablePush}
        disabled={working}
        className="rounded-full border border-[var(--jinka-border)] bg-[var(--jinka-surface)] px-4 py-2 text-sm font-semibold text-[var(--jinka-text)] disabled:opacity-60"
      >
        {connected ? disableLabel : enableLabel}
      </button>
      {message ? <div className="text-sm text-[var(--jinka-muted)]">{message}</div> : null}
    </div>
  );
}
