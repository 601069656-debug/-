import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  disabled,
  ...props 
}) => {
  const baseStyle = "font-display font-bold py-3 px-6 rounded-sm transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0";
  
  const variants = {
    primary: "bg-amber-600 hover:bg-amber-500 text-amber-50 border-2 border-amber-700 shadow-[0_0_15px_rgba(217,119,6,0.3)]",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600",
    ghost: "bg-transparent hover:bg-white/5 text-amber-200/80 hover:text-amber-100"
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};