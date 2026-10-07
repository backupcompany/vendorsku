import React from 'react';

interface SiloamLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'mark';
  theme?: 'dark' | 'light' | 'auto';
}

/** Brand mark — no external hospital logo asset. */
export const SiloamLogo: React.FC<SiloamLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'full',
}) => {
  const box = {
    sm: 'h-8 w-8',
    md: 'h-9 w-9 sm:h-10 sm:w-10',
    lg: 'h-11 w-11 sm:h-12 sm:w-12',
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className={`relative flex ${box[size]} items-center justify-center shrink-0 rounded-xl bg-gradient-to-br from-[#1B3F9B] to-[#0A2263] shadow-md p-1.5 border border-[#1B3F9B]/40`}
      >
        <svg viewBox="0 0 48 48" fill="none" className="w-full h-full" aria-hidden>
          <path
            d="M19 6C19 4.89543 19.8954 4 21 4H27C28.1046 4 29 4.89543 29 6V19H42C43.1046 19 44 19.8954 44 21V27C44 28.1046 43.1046 29 42 29H29V42C29 43.1046 28.1046 44 27 44H21C19.8954 44 19 43.1046 19 42V29H6C4.89543 29 4 28.1046 4 27V21C4 19.8954 4.89543 19 6 19H19V6Z"
            fill="#FFFFFF"
          />
        </svg>
      </div>
      {variant === 'full' && (
        <div className="flex flex-col">
          <span className="font-siloam font-extrabold text-[#0B2361] dark:text-white leading-tight text-base sm:text-lg">
            Vendor Portal
          </span>
          <span className="text-[10px] text-[#E5A823] font-siloam uppercase font-semibold">
            Price List & Mapping
          </span>
        </div>
      )}
    </div>
  );
};
