import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getStoredUser } from '../utils/api';
import Input from '../components/Input';
import Button from '../components/Button';
import Logo from '../components/Logo';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if already logged in
    const token = localStorage.getItem('token');
    const user = getStoredUser();
    if (token && user?.role === 'ADMIN') {
      navigate('/admin/dashboard');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/admin/login', formData);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/admin/dashboard');
    } catch (error) {
      setError(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-root" style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      paddingLeft: 'max(20px, env(safe-area-inset-left))',
      paddingRight: 'max(20px, env(safe-area-inset-right))',
    }}>
      <style>{`
        @media (max-width: 480px) {
          .admin-login-root { padding: 16px !important; }
          .admin-login-card { padding: 24px !important; }
          .admin-login-title { font-size: 22px !important; }
        }
      `}</style>
      <div className="admin-login-card" style={{
        background: 'white',
        borderRadius: '16px',
        padding: '40px',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
          <Logo size="medium" />
        </div>
        <h1 className="admin-login-title" style={{
          fontSize: '28px',
          fontWeight: '700',
          marginBottom: '8px',
          color: '#1e293b',
          textAlign: 'center',
        }}>
          Admin Login
        </h1>
        <p style={{
          fontSize: '14px',
          color: '#64748b',
          textAlign: 'center',
          marginBottom: '32px',
        }}>
          Sign in to manage the system
        </p>

        <form onSubmit={handleSubmit}>
          <Input
            label="Username"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            placeholder="Enter your username"
            required
            autoFocus
          />

          <Input
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="Enter your password"
            required
          />

          {error && (
            <div style={{
              padding: '12px',
              background: '#fee2e2',
              color: '#991b1b',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '14px',
            }}>
              {error}
            </div>
          )}

          <Button
            type="submit"
            fullWidth
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </div>
    </div>
  );
}
