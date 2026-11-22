import React from 'react';

export function ReqitLogo({
  className = 'h-6 w-6',
  rx = 6,
}: {
  className?: string;
  rx?: number;
}): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx={rx} fill="#0F1117" />
      <path
        d="M7 10H16C18.2091 10 20 11.7909 20 14C20 16.2091 18.2091 18 16 18H7V10Z"
        stroke="#06B6D4"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7 18V22" stroke="#06B6D4" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M15 18L21 24"
        stroke="#06B6D4"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M23 11L25 13L23 15"
        stroke="#10B981"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
