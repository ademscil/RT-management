import React from 'react';
import { toast, Toaster as SonnerToaster } from 'sonner';
import { CheckCircle2, XCircle, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import type { AppToastOptions } from '@simrt/shared-types';

export const notify = {
  success: (opts: AppToastOptions) => {
    return toast.success(opts.title, {
      description: opts.description,
      duration: opts.duration || 4000,
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
      action: opts.action
        ? {
            label: opts.action.label,
            onClick: opts.action.onClick,
          }
        : undefined,
    });
  },

  error: (opts: AppToastOptions) => {
    return toast.error(opts.title, {
      description: opts.errorCode ? `${opts.description || ''} (Kode: ${opts.errorCode})` : opts.description,
      duration: opts.duration || 7000, // 7 seconds for error visibility
      icon: <XCircle className="w-5 h-5 text-red-600" />,
      action: opts.action
        ? {
            label: opts.action.label,
            onClick: opts.action.onClick,
          }
        : undefined,
    });
  },

  warning: (opts: AppToastOptions) => {
    return toast.warning(opts.title, {
      description: opts.description,
      duration: opts.duration || 5000,
      icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
      action: opts.action
        ? {
            label: opts.action.label,
            onClick: opts.action.onClick,
          }
        : undefined,
    });
  },

  info: (opts: AppToastOptions) => {
    return toast.info(opts.title, {
      description: opts.description,
      duration: opts.duration || 4000,
      icon: <Info className="w-5 h-5 text-teal-600" />,
      action: opts.action
        ? {
            label: opts.action.label,
            onClick: opts.action.onClick,
          }
        : undefined,
    });
  },

  promise: <T,>(
    promise: Promise<T> | (() => Promise<T>),
    messages: { loading: string; success: string | ((data: T) => string); error: string | ((err: any) => string) }
  ) => {
    return toast.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
    });
  },

  security: (opts: AppToastOptions) => {
    return toast(opts.title, {
      description: opts.auditId ? `${opts.description || ''} - Audit ID: ${opts.auditId}` : opts.description,
      duration: opts.duration || 6000,
      icon: <ShieldAlert className="w-5 h-5 text-violet-600" />,
      className: 'border-2 border-violet-500 bg-violet-50 text-violet-950',
    });
  },
};

export function useAppNotify() {
  return notify;
}

export interface AppToasterProps {
  position?: 'top-center' | 'bottom-right' | 'top-right' | 'bottom-center' | 'top-left' | 'bottom-left';
  expand?: boolean;
  offset?: string | number | { top?: number | string; bottom?: number | string; left?: number | string; right?: number | string };
}

export const AppToaster: React.FC<AppToasterProps> = ({
  position = 'bottom-right',
  expand = true,
  offset,
}) => {
  return (
    <SonnerToaster
      position={position}
      expand={expand}
      offset={offset}
      richColors
      closeButton
      style={{
        fontFamily: 'inherit',
      }}
      toastOptions={{
        className: 'rounded-xl shadow-lg border border-slate-200 dark:border-slate-800',
      }}
    />
  );
};
