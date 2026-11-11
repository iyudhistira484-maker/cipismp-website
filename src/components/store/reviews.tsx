"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { submitReviewAction, type ReviewState } from "@/app/actions/reviews";
import { cn } from "@/lib/utils";

const initial: ReviewState = {};

export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} dari 5 bintang`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          style={{ width: size, height: size }}
          className={star <= Math.round(value) ? "fill-accent text-accent" : "text-line-strong"}
          aria-hidden
        />
      ))}
    </span>
  );
}

export function ReviewForm({ productId, productName }: { productId: string; productName: string }) {
  const [state, action] = useActionState(submitReviewAction, initial);
  const [rating, setRating] = useState(5);

  if (state.success) {
    return <Alert tone="success" title="Ulasan terkirim">{state.success}</Alert>;
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rating" value={rating} />

      <div>
        <span className="mb-1.5 block text-2xs uppercase tracking-wider text-muted-2">Rating</span>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating bintang">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={rating === star}
              aria-label={`${star} bintang`}
              onClick={() => setRating(star)}
              className="rounded p-1 transition-colors hover:bg-surface"
            >
              <Star
                className={cn("size-5", star <= rating ? "fill-accent text-accent" : "text-line-strong")}
                aria-hidden
              />
            </button>
          ))}
          <span className="ml-2 text-[12.5px] text-muted">{rating}/5</span>
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-2xs uppercase tracking-wider text-muted-2">
          Pengalamanmu dengan {productName}
        </span>
        <Textarea
          name="body"
          required
          minLength={15}
          maxLength={1200}
          rows={4}
          placeholder="Ceritakan pengalamanmu memakai rank/kit ini di server — minimal 15 karakter."
        />
      </label>

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-2xs leading-relaxed text-muted-2">
          Ulasan tampil setelah moderasi. Nama disamarkan demi privasi.
        </p>
        <Button type="submit" size="sm">
          Kirim ulasan
        </Button>
      </div>
    </form>
  );
}
