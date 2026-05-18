"use client";

import type React from "react";
import { useFormStatus } from "react-dom";

import { SailboatLoading } from "@/components/sailboat-loading";
import { Button } from "@/components/ui/button";

type PendingSubmitButtonProps = {
  children: React.ReactNode;
  message: string;
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost" | "link";
  className?: string;
  formAction?: React.ComponentProps<"button">["formAction"];
};

export function PendingSubmitButton({
  children,
  message,
  variant = "default",
  className,
  formAction,
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <>
      <Button type="submit" variant={variant} disabled={pending} className={className} formAction={formAction}>
        {pending ? "Pracuji…" : children}
      </Button>
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/85 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[16px] border border-[#D6DFF0] bg-white p-6 shadow-xl">
            <SailboatLoading className="py-2" message={message} />
          </div>
        </div>
      )}
    </>
  );
}
