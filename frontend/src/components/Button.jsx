export default function Button({ 
  children, 
  onClick, 
  variant = 'primary', 
  disabled = false,
  fullWidth = false,
  icon: Icon,
  iconPosition = 'left',
  type,
  style,
  ...props 
}) {
  const baseStyle = {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '14px',
    fontWeight: '600',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
    opacity: disabled ? 0.6 : 1,
    width: fullWidth ? '100%' : 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    boxShadow: (variant === 'primary' || variant === 'success' || variant === 'danger' || variant === 'gradient')
      ? '0 2px 4px rgba(0,0,0,0.1)'
      : 'none',
    ...style,
  };

  const variants = {
    primary: {
      background: disabled ? '#cbd5e1' : '#2563eb',
      color: 'white',
    },
    gradient: {
      background: disabled ? '#cbd5e1' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      boxShadow: disabled ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.4)',
    },
    secondary: {
      background: disabled ? '#cbd5e1' : '#64748b',
      color: 'white',
    },
    success: {
      background: disabled ? '#cbd5e1' : '#10b981',
      color: 'white',
    },
    danger: {
      background: disabled ? '#cbd5e1' : '#ef4444',
      color: 'white',
    },
    outline: {
      background: 'transparent',
      color: disabled ? '#cbd5e1' : '#2563eb',
      border: `2px solid ${disabled ? '#cbd5e1' : '#2563eb'}`,
    },
  };

  const variantStyle = variants[variant] || variants.primary;

  const iconElement = Icon && <Icon size={18} strokeWidth={2.5} />;
  const content = iconPosition === 'left' 
    ? (<> {iconElement} {children} </>)
    : (<> {children} {iconElement} </>);

  return (
    <button
      type={type || 'button'}
      style={{
        ...baseStyle,
        ...variantStyle,
      }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseOver={(e) => {
        if (!disabled) {
          if (variant === 'primary') {
            e.target.style.background = '#1e40af';
            e.target.style.boxShadow = '0 4px 8px rgba(37, 99, 235, 0.3)';
          } else if (variant === 'outline') {
            e.target.style.background = '#eff6ff';
          } else if (variant === 'danger') {
            e.target.style.background = '#dc2626';
            e.target.style.boxShadow = '0 4px 8px rgba(239, 68, 68, 0.3)';
          } else if (variant === 'success') {
            e.target.style.background = '#059669';
            e.target.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.3)';
          } else if (variant === 'gradient') {
            e.target.style.background = 'linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)';
            e.target.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)';
          }
        }
      }}
      onMouseOut={(e) => {
        if (!disabled) {
          e.target.style.background = variantStyle.background;
          e.target.style.boxShadow = variant === 'gradient'
            ? '0 4px 12px rgba(102, 126, 234, 0.4)'
            : (variant === 'primary' || variant === 'success' || variant === 'danger')
              ? '0 2px 4px rgba(0,0,0,0.1)'
              : 'none';
        }
      }}
      {...props}
    >
      {content}
    </button>
  );
}
