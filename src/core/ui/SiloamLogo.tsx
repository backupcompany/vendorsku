import React, { useState } from 'react';

interface SiloamLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'mark';
  theme?: 'dark' | 'light' | 'auto';
}

const OFFICIAL_SILOAM_LOGO_URL = 'https://www.siloamhospitals.com/assets/logo-new-DU4qZWaH.png';

export const SiloamLogo: React.FC<SiloamLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'full',
}) => {
  const [imgError, setImgError] = useState(false);

  const imgHeight = {
    sm: 'h-8 sm:h-9',
    md: 'h-9 sm:h-10 md:h-11',
    lg: 'h-11 sm:h-12 md:h-14',
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {!imgError ? (
        <img
          src={OFFICIAL_SILOAM_LOGO_URL}
          alt="Siloam Hospitals"
          className={`${imgHeight[size]} w-auto object-contain shrink-0`}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      ) : (
        /* Fallback Vector Emblem if external asset is unreachable */
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-10 w-10 items-center justify-center shrink-0 rounded-xl bg-gradient-to-br from-[#1B3F9B] to-[#0A2263] shadow-md p-1.5 border border-[#1B3F9B]/40">
            <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
              <path
                d="M19 6C19 4.89543 19.8954 4 21 4H27C28.1046 4 29 4.89543 29 6V19H42C43.1046 19 44 19.8954 44 21V27C44 28.1046 43.1046 29 42 29H29V42C29 43.1046 28.1046 44 27 44H21C19.8954 44 19 43.1046 19 42V29H6C4.89543 29 4 28.1046 4 27V21C4 19.8954 4.89543 19 6 19H19V6Z"
                fill="#FFFFFF"
              />
              <path
                d="M31 15C31 11.5 28 9.5 24 9.5C18.5 9.5 15 13 15 17C15 23 33 22 33 29C33 34 29 37.5 23.5 37.5C18 37.5 14 34.5 14 30.5"
                stroke="#F5A623"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          {variant === 'full' && (
            <div className="flex flex-col">
              <span className="font-siloam font-extrabold text-[#0B2361] dark:text-white leading-tight text-base sm:text-lg">
                Siloam Hospitals
              </span>
              <span className="text-[10px] text-[#E5A823] font-siloam uppercase font-semibold">
                Healthcare Group
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
