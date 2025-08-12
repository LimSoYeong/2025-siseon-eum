import React from 'react';

export default function UIButton({
  className = '',
  onClick,
  disabled = false,
  title,
  type = 'button',
  children,
}) {
  return (
    <button
      type={type}
      className={className}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}


