import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';
import { Button } from './button.js';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by AppErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 my-4 space-y-4">
          <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900 flex items-center justify-center text-red-600">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {this.props.fallbackTitle || 'Terjadi Masalah pada Komponen Ini'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              Sistem berhasil mengisolasi kesalahan ini agar aplikasi utama tetap berjalan lancar.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={this.handleReset}>
            <RotateCcw className="w-3.5 h-3.5" /> Muat Ulang Komponen
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
