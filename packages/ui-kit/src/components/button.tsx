import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../utils.js';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'pii';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, disabled, children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-xl transition-all select-none active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-offset-2';

    const variants = {
      primary: 'bg-teal-700 text-white hover:bg-teal-800 focus:ring-teal-700 shadow-sm',
      secondary: 'bg-slate-700 text-white hover:bg-slate-800 focus:ring-slate-700 shadow-sm',
      outline: 'border border-slate-300 dark:border-slate-700 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200',
      destructive: 'bg-red-700 text-white hover:bg-red-800 focus:ring-red-700 shadow-sm',
      ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300',
      pii: 'bg-violet-700 text-white hover:bg-violet-800 focus:ring-violet-700 shadow-sm',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-10 px-4 text-sm gap-2 min-h-[44px]', // Mobile friendly min-height
      lg: 'h-12 px-6 text-base gap-2.5 min-h-[48px]',
      icon: 'h-10 w-10 min-h-[44px] min-w-[44px]',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
