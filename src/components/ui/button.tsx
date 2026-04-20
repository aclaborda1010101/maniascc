import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-[13px] font-medium ring-offset-background transition-all duration-200 ease-out-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "text-white border-0 shadow-[0_6px_20px_-6px_hsl(var(--acc-2)/0.5),inset_0_1px_0_hsl(0_0%_100%/0.35)] bg-[linear-gradient(135deg,hsl(var(--acc-1)),hsl(var(--acc-2)))] hover:-translate-y-px hover:shadow-[0_10px_28px_-6px_hsl(var(--acc-2)/0.6),inset_0_1px_0_hsl(0_0%_100%/0.4)]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
        outline:
          "border border-border/80 bg-background/40 backdrop-blur-md text-foreground hover:bg-secondary/60 hover:border-border",
        secondary:
          "bg-secondary text-secondary-foreground border border-border/60 hover:bg-secondary/80",
        ghost:
          "text-foreground hover:bg-secondary/70",
        link: "text-accent underline-offset-4 hover:underline",
        accent:
          "text-[#013220] border-0 font-semibold bg-[hsl(var(--acc-4))] shadow-[0_6px_20px_-6px_hsl(var(--acc-4)/0.6),inset_0_1px_0_hsl(0_0%_100%/0.3)] hover:-translate-y-px",
      },
      size: {
        default: "h-9 px-3.5 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-5 text-sm",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
