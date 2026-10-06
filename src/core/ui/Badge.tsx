import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
}) => {
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';

  const variantClasses = {
    neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    danger: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    info: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded ${sizeClasses} ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
};
