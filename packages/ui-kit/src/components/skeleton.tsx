import React from 'react';
import { cn } from '../utils.js';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div
      className={cn(
        'rounded-md bg-slate-200 dark:bg-slate-800 animate-shimmer overflow-hidden',
        className
      )}
      {...props}
    />
  );
};

export const SkeletonTable: React.FC<{ rows?: number; columns?: number }> = ({ rows = 5, columns = 5 }) => {
  return (
    <div className="w-full space-y-3">
      {/* Table Header Skeleton */}
      <div className="flex items-center gap-4 py-3 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`th-${i}`} className="h-4 flex-1" />
        ))}
      </div>

      {/* Table Rows Skeleton */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={`tr-${r}`} className="flex items-center gap-4 py-3.5 px-4 border-b border-slate-100 dark:border-slate-800">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={`td-${r}-${c}`} className={cn('h-4 flex-1', c === 0 && 'w-1/4')} />
          ))}
        </div>
      ))}
    </div>
  );
};

export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4', className)}>
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <div className="space-y-2 pt-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  );
};
