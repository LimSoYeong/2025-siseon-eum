import React from 'react';

export default function UIButton({
  className = '',
  onClick,
  disabled = false,
  title,
  type = 'button',
  children,
}) {
  const baseHover = [
    'cursor-pointer select-none',
    'transition-all duration-200 ease-out',
    'hover:opacity-100 active:opacity-95',
    'hover:shadow-xl hover:-translate-y-1 active:translate-y-0 active:scale-95',
    'focus-visible:outline-none',
    'disabled:opacity-50 disabled:cursor-not-allowed'
  ].join(' ');
  return (
    <button
      type={type}
      className={`${baseHover} ${className}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}


