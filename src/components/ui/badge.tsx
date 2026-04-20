import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-tight transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        secondary:
          "border-transparent bg-muted text-muted-foreground hover:bg-muted/80",
        destructive:
          "border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.12)] text-destructive",
        outline: "text-foreground border-border/80 bg-transparent",
        accent:
          "border-[hsl(var(--acc-1)/0.32)] bg-[hsl(var(--acc-1)/0.15)] text-[hsl(var(--acc-1))]",
        success:
          "border-[hsl(var(--success)/0.3)] bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]",
        warning:
          "border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning)/0.12)] text-[hsl(var(--warning))]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
