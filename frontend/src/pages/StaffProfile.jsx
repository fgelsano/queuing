import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Input from '../components/Input';
import Button from '../components/Button';
import Loading from '../components/Loading';
import Logo from '../components/Logo';
import { toastSuccess, toastError } from '../components/Toast';

export default function StaffProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [preview, setPreview] = useState(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!token || user?.role !== 'STAFF') {
      navigate('/staff/login');
      return;
    }

    loadProfile();
  }, [navigate]);

  const loadProfile = async () => {
    try {
      const res = await api.get('/staff/profile');
      setStaff(res.data.staff);
      setProfilePicture(res.data.staff.profilePicture);
    } catch (error) {
      console.error('Failed to load profile:', error);
      if (error.response?.status === 401) {
        navigate('/staff/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
      setProfilePicture(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Update name first
      await api.put('/staff/profile', {
        name: staff.name,
      });

      // Upload picture if changed
      if (profilePicture instanceof File) {
        const formData = new FormData();
        formData.append('picture', profilePicture);

        const res = await api.post('/staff/profile/picture', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        setProfilePicture(res.data.profilePicture);
        setPreview(null);
      }

      toastSuccess('Profile updated successfully!');
      navigate('/staff/dashboard');
    } catch (error) {
      console.error('Failed to update profile:', error);
      toastError(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toastError('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toastError('Password must be at least 6 characters');
      return;
    }

    setChangingPassword(true);
    try {
      await api.post('/staff/profile/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      
      toastSuccess('Password changed successfully!');
      setShowPasswordChange(false);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      console.error('Failed to change password:', error);
      toastError(error.response?.data?.error || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loading />
      </div>
    );
  }

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const displayPicture = preview || (staff?.profilePicture ? staff.profilePicture : null);

  return (
    <div className="staff-profile-root" style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <style>{`
        .staff-profile-root {
          padding-left: env(safe-area-inset-left);
          padding-right: env(safe-area-inset-right);
        }
        @media (max-width: 768px) {
          .staff-profile-header {
            flex-wrap: wrap;
            gap: 12px;
            padding: 12px 16px !important;
            padding-left: max(16px, env(safe-area-inset-left)) !important;
            padding-right: max(16px, env(safe-area-inset-right)) !important;
          }
          .staff-profile-content {
            margin: 24px auto !important;
            padding: 0 16px !important;
            padding-left: max(16px, env(safe-area-inset-left)) !important;
            padding-right: max(16px, env(safe-area-inset-right)) !important;
          }
          .staff-profile-card {
            padding: 24px !important;
          }
          .staff-profile-buttons {
            flex-direction: column !important;
          }
          .staff-profile-buttons button {
            width: 100%;
          }
        }
      `}</style>
      {/* Header */}
      <div className="staff-profile-header" style={{
        background: 'white',
        borderBottom: '1px solid #e2e8f0',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Logo size="small" />
        <Button variant="outline" onClick={() => navigate('/staff/dashboard')}>
          Back to Dashboard
        </Button>
      </div>

      <div className="staff-profile-content" style={{
        maxWidth: '600px',
        margin: '40px auto',
        padding: '0 24px',
      }}>
        <div className="staff-profile-card" style={{
          background: 'white',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '700',
            marginBottom: '32px',
            color: '#1e293b',
          }}>
            My Profile
          </h1>

          <form onSubmit={handleSubmit}>
            {/* Profile Picture */}
            <div style={{ marginBottom: '32px', textAlign: 'center' }}>
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                margin: '0 auto 16px',
                border: '3px solid #e2e8f0',
                background: displayPicture
                  ? `url(${displayPicture}) center/cover`
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                fontWeight: '700',
                fontSize: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}>
                {!displayPicture && getInitials(staff?.name)}
              </div>
              <label style={{
                display: 'inline-block',
                padding: '8px 16px',
                background: '#2563eb',
                color: 'white',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseOver={(e) => {
                e.target.style.background = '#1e40af';
              }}
              onMouseOut={(e) => {
                e.target.style.background = '#2563eb';
              }}>
                Change Picture
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </label>
              <p style={{
                fontSize: '12px',
                color: '#64748b',
                marginTop: '8px',
              }}>
                JPG, PNG, GIF, WebP (max 2MB)
              </p>
            </div>

            <Input
              label="Name"
              value={staff?.name || ''}
              onChange={(e) => setStaff({ ...staff, name: e.target.value })}
              required
            />

            <Input
              label="Username"
              value={staff?.username || ''}
              disabled
              style={{ background: '#f1f5f9' }}
            />

            <div className="staff-profile-buttons" style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <Button type="submit" disabled={saving} fullWidth>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/staff/dashboard')}
                fullWidth
              >
                Cancel
              </Button>
            </div>
          </form>

          {/* Password Change Section */}
          <div style={{
            marginTop: '32px',
            paddingTop: '32px',
            borderTop: '1px solid #e2e8f0',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1e293b',
              }}>
                Change Password
              </h3>
              <Button
                variant="outline"
                onClick={() => {
                  setShowPasswordChange(!showPasswordChange);
                  if (showPasswordChange) {
                    setPasswordData({
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: '',
                    });
                  }
                }}
              >
                {showPasswordChange ? 'Cancel' : 'Change Password'}
              </Button>
            </div>

            {showPasswordChange && (
              <form onSubmit={handlePasswordChange}>
                <Input
                  label="Current Password"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({
                    ...passwordData,
                    currentPassword: e.target.value,
                  })}
                  required
                />
                <Input
                  label="New Password"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({
                    ...passwordData,
                    newPassword: e.target.value,
                  })}
                  required
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({
                    ...passwordData,
                    confirmPassword: e.target.value,
                  })}
                  required
                />
                <Button
                  type="submit"
                  disabled={changingPassword}
                  fullWidth
                  style={{ marginTop: '16px' }}
                >
                  {changingPassword ? 'Changing...' : 'Change Password'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
