"use client";

import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function Accordion({ className, ...props }: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root className={cn("divide-y divide-line border-y border-line", className)} {...props} />;
}

export function AccordionItem({ value, question, children }: { value: string; question: string; children: React.ReactNode }) {
  return (
    <AccordionPrimitive.Item value={value} className="group">
      <AccordionPrimitive.Header>
        <AccordionPrimitive.Trigger className="flex w-full items-center justify-between gap-4 py-5 text-left text-[15px] font-medium text-ink transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
          {question}
          <Plus className="size-4 shrink-0 text-muted transition-transform duration-200 ease-out group-data-[state=open]:rotate-45" aria-hidden />
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-none">
        <div className="max-w-2xl pb-5 pr-8 text-[14px] leading-relaxed text-muted">{children}</div>
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
}
