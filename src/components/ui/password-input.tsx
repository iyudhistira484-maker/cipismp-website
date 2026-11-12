"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./field";
import { cn } from "@/lib/utils";

/** Skor kasar di klien untuk meter; validasi final tetap di server (argon2 + aturan lokal). */
export function scorePassword(password: string): { score: number; label: string } {
  let score = 0;
  if (password.length >= 10) score++;
  if (password.length >= 14) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const clamped = Math.min(4, Math.floor((score / 5) * 4));
  const labels = ["Sangat lemah", "Lemah", "Cukup", "Kuat", "Sangat kuat"];
  return { score: clamped, label: labels[clamped]! };
}

export function PasswordInput({
  id,
  name,
  autoComplete,
  required,
  minLength,
  onChange,
  invalid,
  placeholder = "••••••••••",
  withMeter = false,
}: {
  id?: string;
  name: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  onChange?: (value: string) => void;
  invalid?: boolean;
  placeholder?: string;
  withMeter?: boolean;
}) {
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);
  const meter = useMemo(() => scorePassword(value), [value]);
  const bars = ["bg-danger", "bg-danger", "bg-warning", "bg-success", "bg-success"];

  return (
    <div>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          className="pr-11"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            onChange?.(event.target.value);
          }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-1 top-1 grid size-9 place-items-center rounded-[6px] text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {withMeter ? (
        <div className="mt-2 space-y-1.5">
          <div className="flex gap-1" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full bg-line transition-colors duration-200",
                  meter.score > i ? bars[meter.score] : "bg-line",
                )}
              />
            ))}
          </div>
          <p className="text-2xs text-muted-2" aria-live="polite">
            {value ? `Kekuatan: ${meter.label}` : "Minimal 10 karakter, campur huruf besar-kecil dan angka."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
