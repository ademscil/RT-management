import React from 'react';
import { cn } from '../utils.js';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'pii' | 'outline';
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = 'default', children, ...props }) => {
  const variants = {
    default: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-transparent',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
    warning: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
    destructive: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300',
    pii: 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950 dark:text-violet-300',
    outline: 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap shrink-0',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
