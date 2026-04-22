import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border border-primary/20 bg-primary/15 text-foreground hover:bg-primary/20 backdrop-blur-md",
        secondary: "border border-white/10 bg-white/5 text-foreground hover:bg-white/10 backdrop-blur-md",
        destructive: "border border-destructive/20 bg-destructive/15 text-foreground hover:bg-destructive/20 backdrop-blur-md",
        outline: "border-white/15 text-foreground bg-white/5 backdrop-blur-md",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
