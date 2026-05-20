import { cn } from "@/lib/utils";

/** Centered column for first-login / forced password change (Industrial Precision). */
export function AuthLayoutV2({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
