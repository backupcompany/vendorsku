import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:border-slate-700 dark:disabled:bg-slate-800 ${
            leftIcon ? 'pl-9' : ''
          } ${
            error
              ? 'border-red-500 focus:ring-red-500'
              : 'border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600'
          } ${className}`}
          {...props}
        />
      </div>
      {error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
      ) : null}
    </div>
  );
};
