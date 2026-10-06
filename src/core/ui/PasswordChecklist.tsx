import React from 'react';
import { Check, X } from 'lucide-react';
import type { PasswordRule } from '../auth/signInRules';

export const PasswordChecklist: React.FC<{ rules: PasswordRule[] }> = ({ rules }) => (
  <ul className="grid grid-cols-1 gap-0.5 text-[11px] sm:grid-cols-2" aria-live="polite">
    {rules.map((rule) => (
      <li
        key={rule.label}
        className={`flex items-center gap-1 ${rule.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}
      >
        {rule.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
        {rule.label}
      </li>
    ))}
  </ul>
);
