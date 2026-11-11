"use client";

import { useActionState } from "react";
import { Check, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminModerateReviewAction, type ReviewState } from "@/app/actions/reviews";

const initial: ReviewState = {};

export function ModerateReviewButton({
  reviewId,
  status,
}: {
  reviewId: string;
  status: "APPROVED" | "HIDDEN";
}) {
  const [state, action] = useActionState(adminModerateReviewAction, initial);
  return (
    <form action={action} className="inline-flex flex-col gap-1">
      <input type="hidden" name="reviewId" value={reviewId} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" size="sm" variant={status === "APPROVED" ? "primary" : "ghost"}>
        {status === "APPROVED" ? <Check className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />}
        {status === "APPROVED" ? "Tampilkan" : "Sembunyikan"}
      </Button>
      {state.error ? <span className="text-2xs text-danger">{state.error}</span> : null}
    </form>
  );
}
