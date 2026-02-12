import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

const toastTypes = {
  success: { icon: CheckCircle, color: '#10b981', bg: '#d1fae5' },
  error: { icon: XCircle, color: '#ef4444', bg: '#fee2e2' },
  warning: { icon: AlertCircle, color: '#f59e0b', bg: '#fef3c7' },
  info: { icon: Info, color: '#2563eb', bg: '#dbeafe' },
};

let toastId = 0;
const toasts = [];
const listeners = [];

function addToast(message, type = 'info', duration = 3000) {
  const id = toastId++;
  const toast = { id, message, type, duration };
  toasts.push(toast);
  listeners.forEach(listener => listener([...toasts]));
  
  if (duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }
  
  return id;
}

function removeToast(id) {
  const index = toasts.findIndex(t => t.id === id);
  if (index > -1) {
    toasts.splice(index, 1);
    listeners.forEach(listener => listener([...toasts]));
  }
}

export function toast(message, type, duration) {
  return addToast(message, type, duration);
}

export function toastSuccess(message, duration) {
  return addToast(message, 'success', duration);
}

export function toastError(message, duration) {
  return addToast(message, 'error', duration);
}

export function toastWarning(message, duration) {
  return addToast(message, 'warning', duration);
}

export function toastInfo(message, duration) {
  return addToast(message, 'info', duration);
}

export default function ToastContainer() {
  const [toastList, setToastList] = useState([]);

  useEffect(() => {
    const listener = (newToasts) => {
      setToastList(newToasts);
    };
    listeners.push(listener);
    setToastList([...toasts]);
    
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      pointerEvents: 'none',
    }}>
      {(toastList || []).map((toast) => {
        const toastConfig = toastTypes[toast.type] || toastTypes.info;
        const Icon = toastConfig.icon;
        
        return (
          <div
            key={toast.id}
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '16px 20px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              minWidth: '300px',
              maxWidth: '400px',
              pointerEvents: 'auto',
              animation: 'slideIn 0.3s ease-out',
              borderLeft: `4px solid ${toastConfig.color}`,
            }}
          >
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: toastConfig.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Icon size={16} color={toastConfig.color} />
            </div>
            <div style={{
              flex: 1,
              fontSize: '14px',
              color: '#1e293b',
              lineHeight: '1.5',
            }}>
              {toast.message}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                transition: 'color 0.2s',
              }}
              onMouseOver={(e) => {
                e.target.style.color = '#1e293b';
              }}
              onMouseOut={(e) => {
                e.target.style.color = '#64748b';
              }}
            >
              <X size={18} />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
