import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-md border border-line bg-bg/60 px-3.5 text-[15px] text-ink placeholder:text-muted-2 transition-colors duration-150",
        "hover:border-line-strong focus:border-accent/70 focus:outline-none focus:ring-2 focus:ring-accent/25",
        "disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger/70 aria-[invalid=true]:ring-danger/20",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-24 w-full rounded-md border border-line bg-bg/60 px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted-2 transition-colors hover:border-line-strong focus:border-accent/70 focus:outline-none focus:ring-2 focus:ring-accent/25",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-11 w-full appearance-none rounded-md border border-line bg-bg/60 px-3.5 pr-9 text-[15px] text-ink transition-colors",
        "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%228%22%3E%3Cpath%20fill%3D%22%23a69e8f%22%20d%3D%22M6%208L0%200h12z%22/%3E%3C/svg%3E')] bg-[length:10px] bg-[right_14px_center] bg-no-repeat",
        "hover:border-line-strong focus:border-accent/70 focus:outline-none focus:ring-2 focus:ring-accent/25",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-[13px] font-medium text-muted", className)} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  required,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor={htmlFor} className="mb-0">
            {label}
            {required ? <span className="ml-1 text-accent">*</span> : null}
          </Label>
          {hint ? <span className="text-2xs text-muted-2">{hint}</span> : null}
        </div>
      ) : null}
      {children}
      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function CheckboxField({
  label,
  hint,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode; hint?: string; error?: string }) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3 text-[13.5px] leading-relaxed text-muted">
        <input
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 cursor-pointer appearance-none rounded-[4px] border border-line-strong bg-bg checked:border-accent checked:bg-accent checked:bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20fill%3D%22%231a1409%22%20d%3D%22M6.5%2011.2L3.3%208l1.1-1.1%202.1%202.1%205-5L12.6%205z%22/%3E%3C/svg%3E')] checked:bg-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 aria-[invalid=true]:border-danger"
          {...props}
        />
        <span>{label}</span>
      </label>
      {hint ? <p className="ml-7 mt-1 text-2xs text-muted-2">{hint}</p> : null}
      {error ? (
        <p role="alert" className="ml-7 mt-1 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
