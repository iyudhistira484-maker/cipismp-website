"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";

export function FakeCheckoutPanel({
  reference,
  orderNumber,
  statusUrl,
}: {
  reference: string;
  orderNumber: string;
  statusUrl: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"PAID" | "EXPIRED" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function simulate(status: "PAID" | "EXPIRED") {
    setLoading(status);
    setError(null);
    try {
      const res = await fetch("/api/fake/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, status }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !json.ok) throw new Error(json.message ?? "Simulasi gagal");
      router.push(statusUrl);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mt-6 space-y-3">
      <Button size="lg" className="w-full" loading={loading === "PAID"} onClick={() => void simulate("PAID")}>
        Bayar {orderNumber}
      </Button>
      <Button
        size="lg"
        variant="secondary"
        className="w-full"
        loading={loading === "EXPIRED"}
        onClick={() => void simulate("EXPIRED")}
      >
        Simulasikan kedaluwarsa
      </Button>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <p className="text-2xs leading-relaxed text-muted-2">
        Status order hanya berubah setelah webhook bertanda tangan diterima dan diverifikasi server.
      </p>
    </div>
  );
}
