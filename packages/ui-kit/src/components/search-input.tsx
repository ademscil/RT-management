import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '../utils.js';

export interface SearchInputProps {
  id?: string;
  name?: string;
  ariaLabel?: string;
  value?: string;
  onChange: (debouncedValue: string) => void;
  placeholder?: string;
  debounceMs?: number;
  isLoading?: boolean;
  className?: string;
  autoFocus?: boolean;
  enableSlashShortcut?: boolean;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  id = 'search-input',
  name = 'search',
  ariaLabel,
  value: initialValue = '',
  onChange,
  placeholder = 'Cari data...',
  debounceMs = 300,
  isLoading = false,
  className,
  autoFocus = false,
  enableSlashShortcut = true,
}) => {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes
  useEffect(() => {
    setSearchTerm(initialValue);
  }, [initialValue]);

  // Debounce effect
  useEffect(() => {
    setIsDebouncing(true);
    const handler = setTimeout(() => {
      onChange(searchTerm.trim());
      setIsDebouncing(false);
    }, debounceMs);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm, debounceMs, onChange]);

  // Press "/" to focus search input
  useEffect(() => {
    if (!enableSlashShortcut) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        const tagName = document.activeElement?.tagName.toLowerCase();
        if (tagName !== 'input' && tagName !== 'textarea') {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableSlashShortcut]);

  const handleClear = () => {
    setSearchTerm('');
    inputRef.current?.focus();
  };

  return (
    <div className={cn('relative flex items-center w-full max-w-sm', className)}>
      <div className="absolute left-3 flex items-center pointer-events-none text-slate-400">
        {isLoading || isDebouncing ? (
          <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
        ) : (
          <Search className="w-4 h-4" />
        )}
      </div>

      <input
        ref={inputRef}
        id={id}
        name={name}
        type="search"
        role="searchbox"
        aria-label={ariaLabel || placeholder || 'Pencarian data'}
        autoComplete="off"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full pl-9 pr-12 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-600 focus:border-teal-600 outline-none transition-all placeholder:text-slate-400 text-slate-900 dark:text-slate-100"
      />

      <div className="absolute right-2.5 flex items-center gap-1.5">
        {searchTerm ? (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Hapus pencarian"
            aria-label="Hapus pencarian"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : enableSlashShortcut ? (
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">
            /
          </kbd>
        ) : null}
      </div>
    </div>
  );
};
