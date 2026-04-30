import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-[12px] bg-[#D6DFF0]/70", className)}
      {...props}
    />
  )
}

export { Skeleton }
