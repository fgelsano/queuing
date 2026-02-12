import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactDOM from 'react-dom';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { 
  LayoutDashboard, Users, Square, FolderTree, FileText, Settings, 
  Plus, Edit, Trash2, Power, KeyRound, X, Check, AlertCircle,
  TrendingUp, Activity, Clock, UserCheck, Filter, Calendar, 
  PlayCircle, Hourglass, CheckCircle, Monitor, UserCircle, 
  Building2, Users2
} from 'lucide-react';
import api from '../utils/api';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import Loading from '../components/Loading';
import Logo from '../components/Logo';
import AdminProfileDropdown from '../components/AdminProfileDropdown';
import { toastSuccess, toastError, toastWarning, toastInfo } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import InputDialog from '../components/InputDialog';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// Show API error in toast: use single .error string, or first validation .errors[].msg, or fallback
function getApiErrorMessage(error, fallback) {
  const d = error?.response?.data;
  if (d?.error && typeof d.error === 'string') return d.error;
  if (Array.isArray(d?.errors) && d.errors.length > 0) {
    const first = d.errors[0];
    return first?.msg || first?.message || fallback;
  }
  return fallback;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [staff, setStaff] = useState([]);
  const [windows, setWindows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [reports, setReports] = useState(null);
  const [reportFilters, setReportFilters] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    staffIds: [],
    categoryIds: [],
    clientTypes: [],
    startHour: '',
    endHour: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Form states
  const [staffForm, setStaffForm] = useState({ open: false, data: {} });
  const [windowForm, setWindowForm] = useState({ open: false, data: {} });
  const [categoryForm, setCategoryForm] = useState({ open: false, data: {} });
  const [subCategoryForm, setSubCategoryForm] = useState({ open: false, data: {} });
  const [inputDialog, setInputDialog] = useState({ open: false, title: '', message: '', placeholder: '', type: 'text', onConfirm: () => {}, onCancel: () => {} });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!token || user?.role !== 'ADMIN') {
      navigate('/admin/login');
      return;
    }

    loadData();
    const interval = setInterval(() => {
      if (activeTab === 'dashboard') {
        loadDashboard();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [navigate, activeTab]);

  useEffect(() => {
    if (activeTab === 'reports') {
      loadReports();
    }
  }, [activeTab, reportFilters]);

  const loadData = async () => {
    try {
      await Promise.all([
        loadDashboard(),
        loadStaff(),
        loadWindows(),
        loadCategories(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      // Always set loading to false, even if some requests fail
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      const res = await api.get('/admin/dashboard');
      setDashboardStats(res.data.stats);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    }
  };

  const loadStaff = async () => {
    try {
      const res = await api.get('/admin/staff');
      setStaff(res.data.staff);
    } catch (error) {
      console.error('Failed to load staff:', error);
    }
  };

  const loadWindows = async () => {
    try {
      const res = await api.get('/admin/windows');
      setWindows(res.data.windows);
    } catch (error) {
      console.error('Failed to load windows:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data.categories);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadReports = async () => {
    try {
      const params = new URLSearchParams();
      params.append('startDate', reportFilters.startDate);
      params.append('endDate', reportFilters.endDate);
      
      if (reportFilters.staffIds && reportFilters.staffIds.length > 0) {
        reportFilters.staffIds.forEach(id => params.append('staffId', id));
      }
      if (reportFilters.categoryIds && reportFilters.categoryIds.length > 0) {
        reportFilters.categoryIds.forEach(id => params.append('categoryId', id));
      }
      if (reportFilters.clientTypes && reportFilters.clientTypes.length > 0) {
        reportFilters.clientTypes.forEach(type => params.append('clientType', type));
      }
      if (reportFilters.startHour) {
        params.append('startHour', reportFilters.startHour);
      }
      if (reportFilters.endHour) {
        params.append('endHour', reportFilters.endHour);
      }

      const res = await api.get(`/admin/reports?${params.toString()}`);
      setReports(res.data);
    } catch (error) {
      console.error('Failed to load reports:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/admin/login');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loading />
      </div>
    );
  }

  return (
    <>
      <style>{`
        .admin-dashboard-root {
          padding-left: env(safe-area-inset-left);
          padding-right: env(safe-area-inset-right);
        }
        .admin-dashboard-content {
          padding-left: max(24px, env(safe-area-inset-left));
          padding-right: max(24px, env(safe-area-inset-right));
        }
        @media (max-width: 768px) {
          .admin-dashboard-header {
            flex-wrap: wrap;
            gap: 12px;
            padding: 12px 16px !important;
            padding-left: max(16px, env(safe-area-inset-left)) !important;
            padding-right: max(16px, env(safe-area-inset-right)) !important;
          }
          .admin-dashboard-header > div:first-child {
            flex-direction: row;
            align-items: center;
            gap: 12px;
          }
          .admin-dashboard-header h1 {
            font-size: 20px !important;
          }
          .admin-dashboard-tabs {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            padding: 0 16px !important;
            padding-left: max(16px, env(safe-area-inset-left)) !important;
          }
          .admin-dashboard-tabs button {
            white-space: nowrap;
            font-size: 13px;
            padding: 10px 16px !important;
            min-height: 44px;
            flex-shrink: 0;
          }
          .admin-dashboard-tabs button span {
            display: none;
          }
          .admin-dashboard-content {
            padding: 16px !important;
            padding-left: max(16px, env(safe-area-inset-left)) !important;
            padding-right: max(16px, env(safe-area-inset-right)) !important;
          }
          .admin-stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .admin-stats-grid-4 {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .admin-cards-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .admin-reports-grid {
            grid-template-columns: 1fr !important;
          }
          .admin-filter-grid {
            grid-template-columns: 1fr !important;
          }
          .admin-page-header {
            flex-direction: column;
            align-items: flex-start !important;
            gap: 12px;
          }
          .settings-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .admin-modal-overlay {
            padding: 16px;
            align-items: flex-start;
            overflow-y: auto;
          }
          .admin-modal-box {
            max-height: calc(100vh - 32px);
            overflow-y: auto;
            width: 100%;
            margin: auto;
          }
          .admin-settings-buttons {
            flex-wrap: wrap;
          }
          .admin-settings-buttons button {
            min-width: 140px;
          }
          .admin-reports-table-wrap {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            margin: 0 -16px;
            padding: 0 16px;
          }
        }
        @media (max-width: 480px) {
          .admin-stats-grid,
          .admin-stats-grid-4,
          .admin-cards-grid {
            grid-template-columns: 1fr !important;
          }
          .admin-dashboard-tabs button {
            padding: 12px 14px !important;
          }
        }
        @media (max-width: 1024px) and (min-width: 769px) {
          .admin-stats-grid-4 {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .admin-cards-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
          .settings-grid {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            gap: 16px;
          }
        }
      `}</style>
      <div className="admin-dashboard-root" style={{ minHeight: '100vh', background: '#f8fafc' }}>
        <InputDialog {...inputDialog} />
        {/* Header */}
        <div className="admin-dashboard-header" style={{
          background: 'white',
          borderBottom: '1px solid #e2e8f0',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1 }}>
            <Logo size="small" />
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
              Admin Dashboard
            </h1>
          </div>
          <AdminProfileDropdown onLogout={handleLogout} />
        </div>

        {/* Tabs */}
        <div className="admin-dashboard-tabs" style={{
          background: 'white',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 24px',
          display: 'flex',
          gap: '4px',
        }}>
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'staff', label: 'Staff', icon: Users },
          { id: 'windows', label: 'Windows', icon: Square },
          { id: 'categories', label: 'Categories', icon: FolderTree },
          { id: 'reports', label: 'Reports', icon: FileText },
          { id: 'settings', label: 'Settings', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 20px',
                border: 'none',
                background: isActive ? '#eff6ff' : 'transparent',
                borderBottom: isActive ? '3px solid #2563eb' : '3px solid transparent',
                color: isActive ? '#2563eb' : '#64748b',
                fontWeight: isActive ? '600' : '400',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                borderRadius: '8px 8px 0 0',
              }}
              onMouseOver={(e) => {
                if (!isActive) {
                  e.target.style.background = '#f1f5f9';
                  e.target.style.color = '#475569';
                }
              }}
              onMouseOut={(e) => {
                if (!isActive) {
                  e.target.style.background = 'transparent';
                  e.target.style.color = '#64748b';
                }
              }}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="admin-dashboard-content" style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
        {activeTab === 'dashboard' && <DashboardTab stats={dashboardStats} />}
        {activeTab === 'staff' && (
          <StaffTab
            staff={staff}
            categories={categories}
            onRefresh={loadStaff}
            form={staffForm}
            setForm={setStaffForm}
            setInputDialog={setInputDialog}
          />
        )}
        {activeTab === 'windows' && (
          <WindowsTab
            windows={windows}
            onRefresh={loadWindows}
            form={windowForm}
            setForm={setWindowForm}
          />
        )}
        {activeTab === 'categories' && (
          <CategoriesTab
            categories={categories}
            onRefresh={loadCategories}
            categoryForm={categoryForm}
            setCategoryForm={setCategoryForm}
            subCategoryForm={subCategoryForm}
            setSubCategoryForm={setSubCategoryForm}
          />
        )}
        {activeTab === 'reports' && (
          <ReportsTab
            reports={reports}
            filters={reportFilters}
            setFilters={setReportFilters}
            staff={staff}
            categories={categories}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            onRefresh={loadReports}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab />
        )}
      </div>
    </div>
    </>
  );
}

function DashboardTab({ stats }) {
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    // Update date/time every second
    const interval = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!stats) return <Loading />;

  // Format date and time with seconds
  const formatDateTime = (date) => {
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    const weekday = weekdays[date.getDay()];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    
    // Format: "Monday, January 26, 2026 at 9:50:51 AM"
    return `${weekday}, ${month} ${day}, ${year} at ${hours}:${minutes}:${seconds} ${ampm}`;
  };

  return (
    <div>
      {/* Date and Time Display */}
      <div style={{
        marginBottom: '24px',
      }}>
        <div style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#1e293b',
        }}>
          {formatDateTime(currentDateTime)}
        </div>
      </div>

      {/* Stats Cards - Row 1 */}
      <div className="admin-stats-grid-4" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '16px',
      }}>
        <StatCard 
          label="Queue Entries Today" 
          value={stats.todayQueueEntries} 
          icon={Calendar}
          color="#2563eb"
        />
        <StatCard 
          label="Serving" 
          value={stats.servingCount} 
          icon={PlayCircle}
          color="#2563eb"
        />
        <StatCard 
          label="Waiting" 
          value={stats.waitingCount} 
          icon={Hourglass}
          color="#f59e0b"
        />
        <StatCard 
          label="Served Today" 
          value={stats.todayServed} 
          icon={CheckCircle}
          color="#10b981"
        />
      </div>

      {/* Stats Cards - Row 2 */}
      <div className="admin-stats-grid-4" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '24px',
      }}>
        <StatCard 
          label="Active Windows" 
          value={stats.activeWindows} 
          icon={Monitor}
          color="#10b981"
        />
        <StatCard 
          label="Active Staff" 
          value={stats.activeStaff} 
          icon={UserCheck}
          color="#10b981"
        />
        <StatCard 
          label="Total Windows" 
          value={stats.totalWindows} 
          icon={Building2}
          color="#2563eb"
        />
        <StatCard 
          label="Total Staff" 
          value={stats.totalStaff} 
          icon={Users2}
          color="#2563eb"
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, color = '#2563eb', icon: Icon }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        marginBottom: '12px' 
      }}>
        {Icon && (
          <Icon 
            size={20} 
            color={color}
            style={{ flexShrink: 0 }}
          />
        )}
        <div style={{ 
          fontSize: '14px', 
          color: '#64748b',
          fontWeight: '500',
        }}>
          {label}
        </div>
      </div>
      <div style={{ 
        fontSize: '32px', 
        fontWeight: '700', 
        color,
        lineHeight: '1.2',
      }}>
        {value || 0}
      </div>
    </div>
  );
}

function StaffTab({ staff, categories, onRefresh, form, setForm, setInputDialog }) {
  const [editing, setEditing] = useState(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowCategoryDropdown(false);
      }
    };

    if (showCategoryDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCategoryDropdown]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/staff', form.data);
      setForm({ open: false, data: {} });
      toastSuccess('Staff created successfully!');
      onRefresh();
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Failed to create staff'));
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/admin/staff/${editing.id}`, form.data);
      setForm({ open: false, data: {} });
      setEditing(null);
      toastSuccess('Staff updated successfully!');
      onRefresh();
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Failed to update staff'));
    }
  };

  const handleToggleActive = async (staffId, isActive) => {
    try {
      await api.put(`/admin/staff/${staffId}`, { isActive: !isActive });
      toastSuccess(`Staff ${!isActive ? 'activated' : 'deactivated'} successfully!`);
      onRefresh();
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Failed to update staff'));
    }
  };

  const handleResetPassword = async (staffId, staffName) => {
    setInputDialog({
      open: true,
      title: 'Reset Password',
      message: `Enter new password for ${staffName}:`,
      placeholder: 'New password (min 6 characters)',
      type: 'password',
      onConfirm: async (newPassword) => {
        setInputDialog({ open: false });
        if (!newPassword) return;
        
        if (newPassword.length < 6) {
          toastError('Password must be at least 6 characters');
          return;
        }

        try {
          await api.post(`/admin/staff/${staffId}/reset-password`, { password: newPassword });
          toastSuccess('Password reset successfully!');
        } catch (error) {
          toastError(error.response?.data?.error || 'Failed to reset password');
        }
      },
      onCancel: () => setInputDialog({ open: false }),
    });
  };

  return (
    <div>
      <ConfirmDialog {...confirmDialog} />
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600' }}>Staff Management</h2>
        <Button onClick={() => {
          setForm({ open: true, data: {} });
          setEditing(null);
        }}>
          Add Staff
        </Button>
      </div>

      {form.open && ReactDOM.createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
        }} onClick={() => {
          setForm({ open: false, data: {} });
          setEditing(null);
        }} className="admin-modal-overlay">
          <div className="admin-modal-box" style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}>
              <h3 style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>
                {editing ? 'Edit Staff' : 'Create Staff'}
              </h3>
              <button
                onClick={() => {
                  setForm({ open: false, data: {} });
                  setEditing(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={editing ? handleUpdate : handleCreate}>
              <Input
                label="Username"
                value={form.data.username || ''}
                onChange={(e) => setForm({ ...form, data: { ...form.data, username: e.target.value } })}
                required={!editing}
                disabled={!!editing}
              />
              <Input
                label="Name"
                value={form.data.name || ''}
                onChange={(e) => setForm({ ...form, data: { ...form.data, name: e.target.value } })}
                required
              />
              {(!editing || form.data.password) && (
                <Input
                  label="Password"
                  type="password"
                  value={form.data.password || ''}
                  onChange={(e) => setForm({ ...form, data: { ...form.data, password: e.target.value } })}
                  required={!editing}
                />
              )}
              <div style={{ marginBottom: '16px', position: 'relative' }} ref={dropdownRef}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>
                  Specializations (Categories)
                </label>
                <div
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '2px solid #e2e8f0',
                    fontSize: '14px',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    minHeight: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '6px',
                  }}
                >
                  {form.data.categoryIds && form.data.categoryIds.length > 0 ? (
                    form.data.categoryIds.map((catId) => {
                      const cat = categories.find(c => c.id === catId);
                      return cat ? (
                        <span
                          key={catId}
                          style={{
                            fontSize: '12px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: '#eff6ff',
                            color: '#2563eb',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setForm({
                              ...form,
                              data: {
                                ...form.data,
                                categoryIds: form.data.categoryIds.filter(id => id !== catId),
                              },
                            });
                          }}
                        >
                          {cat.name}
                          <X size={12} />
                        </span>
                      ) : null;
                    })
                  ) : (
                    <span style={{ color: '#94a3b8' }}>Select categories...</span>
                  )}
                </div>
                {showCategoryDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '4px',
                      background: 'white',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      zIndex: 1000,
                      maxHeight: '200px',
                      overflowY: 'auto',
                    }}
                  >
                    {categories.map((cat) => {
                      const isSelected = form.data.categoryIds?.includes(cat.id) || false;
                      return (
                        <div
                          key={cat.id}
                          onClick={() => {
                            const ids = form.data.categoryIds || [];
                            if (isSelected) {
                              setForm({
                                ...form,
                                data: {
                                  ...form.data,
                                  categoryIds: ids.filter(id => id !== cat.id),
                                },
                              });
                            } else {
                              setForm({
                                ...form,
                                data: {
                                  ...form.data,
                                  categoryIds: [...ids, cat.id],
                                },
                              });
                            }
                          }}
                          style={{
                            padding: '10px 12px',
                            cursor: 'pointer',
                            background: isSelected ? '#eff6ff' : 'white',
                            color: isSelected ? '#2563eb' : '#1e293b',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            borderBottom: '1px solid #f1f5f9',
                          }}
                          onMouseOver={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = '#f8fafc';
                            }
                          }}
                          onMouseOut={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = 'white';
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            style={{ cursor: 'pointer' }}
                          />
                          <span>{cat.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <Button 
                  variant="outline" 
                  icon={X}
                  onClick={() => {
                    setForm({ open: false, data: {} });
                    setEditing(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" icon={Check}>
                  {editing ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      <div className="admin-cards-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
      }}>
        {staff.map((s) => {
          const initials = s.name ? s.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : s.username.charAt(0).toUpperCase();
          const specializations = s.specializations ? s.specializations.map(sp => sp.category.name) : [];
          
          return (
            <div key={s.id} style={{
              background: 'white',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              alignItems: 'center',
            }}>
              {/* Profile Image/Initials */}
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: s.profilePictureUrl ? 'transparent' : '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                marginBottom: '8px',
                border: s.profilePictureUrl ? '2px solid #e2e8f0' : 'none',
              }}>
                {s.profilePictureUrl ? (
                  <img 
                    src={s.profilePictureUrl} 
                    alt={s.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <span style={{
                    color: 'white',
                    fontSize: '28px',
                    fontWeight: '600',
                  }}>
                    {initials}
                  </span>
                )}
              </div>

              {/* Name and Username */}
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '2px' }}>
                  {s.name}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  {s.username}
                </div>
              </div>

              {/* Specializations Badges */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                justifyContent: 'center',
                marginBottom: '8px',
              }}>
                {specializations.length > 0 ? (
                  specializations.map((spec, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '11px',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        background: '#eff6ff',
                        color: '#2563eb',
                        fontWeight: '500',
                      }}
                    >
                      {spec}
                    </span>
                  ))
                ) : (
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      background: '#f1f5f9',
                      color: '#64748b',
                      fontWeight: '500',
                    }}
                  >
                    All categories
                  </span>
                )}
              </div>

              {/* Status Badge */}
              <div style={{ marginBottom: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    background: s.isActive ? '#ecfdf5' : '#fef2f2',
                    color: s.isActive ? '#059669' : '#dc2626',
                    fontWeight: '600',
                  }}
                >
                  {s.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto', width: '100%' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    setEditing(s);
                    setForm({
                      open: true,
                      data: {
                        username: s.username,
                        name: s.name,
                        categoryIds: s.specializations ? s.specializations.map(sp => sp.categoryId) : [],
                      },
                    });
                  }}
                  style={{ 
                    fontSize: '12px', 
                    padding: '6px 12px',
                    border: 'none',
                    background: 'transparent',
                    color: '#2563eb',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontWeight: '500',
                    borderRadius: '6px',
                    transition: 'all 0.2s',
                    width: '25%',
                  }}
                  onMouseOver={(e) => {
                    e.target.style.background = '#eff6ff';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.background = 'transparent';
                  }}
                >
                  <Edit size={14} />
                  Edit
                </button>
                <button
                  onClick={() => handleResetPassword(s.id, s.name)}
                  style={{ 
                    fontSize: '12px', 
                    padding: '6px 12px',
                    border: 'none',
                    background: 'transparent',
                    color: '#2563eb',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontWeight: '500',
                    borderRadius: '6px',
                    transition: 'all 0.2s',
                    width: '75%',
                  }}
                  onMouseOver={(e) => {
                    e.target.style.background = '#eff6ff';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.background = 'transparent';
                  }}
                >
                  <KeyRound size={14} />
                  Reset Password
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <Button
                  variant={s.isActive ? 'danger' : 'success'}
                  icon={Power}
                  onClick={() => handleToggleActive(s.id, s.isActive)}
                  style={{ 
                    fontSize: '12px', 
                    padding: '6px 12px',
                    flex: 1,
                  }}
                >
                  {s.isActive ? 'Deactivate' : 'Activate'}
                </Button>
                <Button
                  variant="danger"
                  icon={Trash2}
                  onClick={() => {
                    setConfirmDialog({
                      open: true,
                      title: 'Remove Staff',
                      message: `Are you sure you want to remove ${s.name || s.username}? This cannot be undone and is only allowed if the staff has no serving history.`,
                      onConfirm: async () => {
                        setConfirmDialog({ open: false });
                        try {
                          await api.delete(`/admin/staff/${s.id}`);
                          toastSuccess('Staff removed successfully!');
                          onRefresh();
                        } catch (error) {
                          toastError(getApiErrorMessage(error, 'Failed to remove staff'));
                        }
                      },
                      onCancel: () => setConfirmDialog({ open: false }),
                    });
                  }}
                  style={{
                    fontSize: '12px',
                    padding: '6px 12px',
                    flex: 1,
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

function WindowsTab({ windows, onRefresh, form, setForm }) {
  const [editing, setEditing] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false });

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/windows', form.data);
      setForm({ open: false, data: {} });
      toastSuccess('Window created successfully!');
      onRefresh();
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Failed to create window'));
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/admin/windows/${editing.id}`, form.data);
      setForm({ open: false, data: {} });
      setEditing(null);
      toastSuccess('Window updated successfully!');
      onRefresh();
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Failed to update window'));
    }
  };

  const handleDelete = async (id) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Window',
      message: 'Are you sure you want to delete this window? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmDialog({ open: false });
        try {
          await api.delete(`/admin/windows/${id}`);
          toastSuccess('Window deleted successfully!');
          onRefresh();
        } catch (error) {
          toastError(getApiErrorMessage(error, 'Failed to delete window'));
        }
      },
      onCancel: () => setConfirmDialog({ open: false }),
    });
  };

  return (
    <div>
      <ConfirmDialog {...confirmDialog} />
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600' }}>Window Management</h2>
        <Button 
          icon={Plus}
          onClick={() => {
            setForm({ open: true, data: { isActive: true } });
            setEditing(null);
          }}
        >
          Add Window
        </Button>
      </div>

      {form.open && ReactDOM.createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
        }} onClick={() => {
          setForm({ open: false, data: {} });
          setEditing(null);
        }} className="admin-modal-overlay">
          <div className="admin-modal-box" style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}>
              <h3 style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>
                {editing ? 'Edit Window' : 'Create Window'}
              </h3>
              <button
                onClick={() => {
                  setForm({ open: false, data: {} });
                  setEditing(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={editing ? handleUpdate : handleCreate}>
              <Input
                label="Window Label"
                value={form.data.label || ''}
                onChange={(e) => setForm({ ...form, data: { ...form.data, label: e.target.value } })}
                required
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="checkbox"
                  checked={form.data.isActive !== false}
                  onChange={(e) => setForm({ ...form, data: { ...form.data, isActive: e.target.checked } })}
                />
                Active
              </label>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <Button 
                  variant="outline" 
                  icon={X}
                  onClick={() => {
                    setForm({ open: false, data: {} });
                    setEditing(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" icon={Check}>
                  {editing ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      <div className="admin-cards-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
      }}>
        {windows.map((w) => (
          <div key={w.id} style={{
            background: 'white',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'center',
          }}>
            {/* Window Icon */}
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '8px',
            }}>
              <Square size={40} color="white" />
            </div>

            {/* Window Label */}
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '2px' }}>
                {w.label}
              </div>
            </div>

            {/* Assigned Staff Badges */}
            {w.assignments && w.assignments.length > 0 && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                justifyContent: 'center',
                marginBottom: '8px',
              }}>
                {w.assignments.map((assignment) => (
                  <span
                    key={assignment.id}
                    style={{
                      fontSize: '11px',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      background: '#eff6ff',
                      color: '#2563eb',
                      fontWeight: '500',
                    }}
                  >
                    {assignment.staff.name}
                  </span>
                ))}
              </div>
            )}

            {/* Status Badge */}
            <div style={{ marginBottom: '8px' }}>
              <span
                style={{
                  fontSize: '11px',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  background: w.isActive ? '#ecfdf5' : '#fef2f2',
                  color: w.isActive ? '#059669' : '#dc2626',
                  fontWeight: '600',
                }}
              >
                {w.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto', width: '100%' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    setEditing(w);
                    setForm({
                      open: true,
                      data: {
                        label: w.label,
                        isActive: w.isActive,
                      },
                    });
                  }}
                  style={{ 
                    fontSize: '12px', 
                    padding: '6px 12px',
                    border: 'none',
                    background: 'transparent',
                    color: '#2563eb',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontWeight: '500',
                    borderRadius: '6px',
                    transition: 'all 0.2s',
                    width: '50%',
                  }}
                  onMouseOver={(e) => {
                    e.target.style.background = '#eff6ff';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.background = 'transparent';
                  }}
                >
                  <Edit size={14} />
                  Edit
                </button>
                <Button
                  variant="danger"
                  icon={Trash2}
                  onClick={() => handleDelete(w.id)}
                  style={{ 
                    fontSize: '12px', 
                    padding: '6px 12px',
                    width: '50%',
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoriesTab({ categories, onRefresh, categoryForm, setCategoryForm, subCategoryForm, setSubCategoryForm }) {
  const [editingCategory, setEditingCategory] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false });

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/categories', categoryForm.data);
      setCategoryForm({ open: false, data: {} });
      toastSuccess('Category created successfully!');
      onRefresh();
    } catch (error) {
      toastError(error.response?.data?.error || 'Failed to create category');
    }
  };

  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/admin/categories/${editingCategory.id}`, categoryForm.data);
      setCategoryForm({ open: false, data: {} });
      setEditingCategory(null);
      toastSuccess('Category updated successfully!');
      onRefresh();
    } catch (error) {
      toastError(error.response?.data?.error || 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (id) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Category',
      message: 'Are you sure you want to delete this category? All subcategories will be deleted. This action cannot be undone.',
      onConfirm: async () => {
        setConfirmDialog({ open: false });
        try {
          await api.delete(`/admin/categories/${id}`);
          toastSuccess('Category deleted successfully!');
          onRefresh();
        } catch (error) {
          toastError(error.response?.data?.error || 'Failed to delete category');
        }
      },
      onCancel: () => setConfirmDialog({ open: false }),
    });
  };

  const handleCreateSubCategory = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/admin/categories/${subCategoryForm.data.categoryId}/subcategories`, {
        name: subCategoryForm.data.name,
        description: subCategoryForm.data.description,
      });
      setSubCategoryForm({ open: false, data: {} });
      toastSuccess('Subcategory created successfully!');
      onRefresh();
    } catch (error) {
      toastError(error.response?.data?.error || 'Failed to create subcategory');
    }
  };

  const handleDeleteSubCategory = async (id) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Subcategory',
      message: 'Are you sure you want to delete this subcategory? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmDialog({ open: false });
        try {
          await api.delete(`/admin/subcategories/${id}`);
          toastSuccess('Subcategory deleted successfully!');
          onRefresh();
        } catch (error) {
          toastError(error.response?.data?.error || 'Failed to delete subcategory');
        }
      },
      onCancel: () => setConfirmDialog({ open: false }),
    });
  };

  return (
    <div>
      <ConfirmDialog {...confirmDialog} />
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600' }}>Category Management</h2>
        <Button 
          icon={Plus}
          onClick={() => {
            setCategoryForm({ open: true, data: {} });
            setEditingCategory(null);
          }}
        >
          Add Category
        </Button>
      </div>

      {categoryForm.open && ReactDOM.createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
        }} onClick={() => {
          setCategoryForm({ open: false, data: {} });
          setEditingCategory(null);
        }} className="admin-modal-overlay">
          <div className="admin-modal-box" style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}>
              <h3 style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>
                {editingCategory ? 'Edit Category' : 'Create Category'}
              </h3>
              <button
                onClick={() => {
                  setCategoryForm({ open: false, data: {} });
                  setEditingCategory(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={editingCategory ? handleUpdateCategory : handleCreateCategory}>
              <Input
                label="Category Name"
                value={categoryForm.data.name || ''}
                onChange={(e) => setCategoryForm({ ...categoryForm, data: { ...categoryForm.data, name: e.target.value } })}
                required
              />
              <Input
                label="Description (Optional)"
                value={categoryForm.data.description || ''}
                onChange={(e) => setCategoryForm({ ...categoryForm, data: { ...categoryForm.data, description: e.target.value } })}
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <Button 
                  variant="outline" 
                  icon={X}
                  onClick={() => {
                    setCategoryForm({ open: false, data: {} });
                    setEditingCategory(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" icon={Check}>
                  {editingCategory ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {subCategoryForm.open && ReactDOM.createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
        }} onClick={() => {
          setSubCategoryForm({ open: false, data: {} });
        }} className="admin-modal-overlay">
          <div className="admin-modal-box" style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}>
              <h3 style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>
                Add Subcategory
              </h3>
              <button
                onClick={() => {
                  setSubCategoryForm({ open: false, data: {} });
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateSubCategory}>
              <Input
                label="Subcategory Name"
                value={subCategoryForm.data.name || ''}
                onChange={(e) => setSubCategoryForm({ ...subCategoryForm, data: { ...subCategoryForm.data, name: e.target.value } })}
                required
              />
              <Input
                label="Description (Optional)"
                value={subCategoryForm.data.description || ''}
                onChange={(e) => setSubCategoryForm({ ...subCategoryForm, data: { ...subCategoryForm.data, description: e.target.value } })}
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <Button 
                  variant="outline" 
                  icon={X}
                  onClick={() => {
                    setSubCategoryForm({ open: false, data: {} });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" icon={Check}>
                  Create
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      <div className="admin-cards-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
      }}>
        {categories.map((cat) => (
          <div key={cat.id} style={{
            background: 'white',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'center',
          }}>
            {/* Category Icon */}
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '8px',
            }}>
              <FolderTree size={40} color="white" />
            </div>

            {/* Category Name */}
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '2px' }}>
                {cat.name}
              </div>
              {cat.description && (
                <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.4' }}>
                  {cat.description}
                </div>
              )}
            </div>

            {/* Subcategories Count Badge */}
            {cat.subCategories && cat.subCategories.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    fontWeight: '600',
                  }}
                >
                  {cat.subCategories.length} Subcategor{cat.subCategories.length === 1 ? 'y' : 'ies'}
                </span>
              </div>
            )}

            {/* Subcategories List */}
            {cat.subCategories && cat.subCategories.length > 0 && (
              <div style={{ 
                width: '100%', 
                marginBottom: '8px',
                maxHeight: '120px',
                overflowY: 'auto',
                padding: '8px',
                background: '#f8fafc',
                borderRadius: '8px',
              }}>
                {cat.subCategories.map((subCat) => (
                  <div key={subCat.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 8px',
                    marginBottom: '4px',
                    background: 'white',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}>
                    <span style={{ fontWeight: '500', color: '#1e293b' }}>
                      {subCat.name}
                    </span>
                    <button
                      onClick={() => handleDeleteSubCategory(subCat.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: '12px',
                        borderRadius: '4px',
                      }}
                      onMouseOver={(e) => {
                        e.target.style.background = '#fee2e2';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.background = 'transparent';
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto', width: '100%' }}>
              <Button
                variant="outline"
                icon={Plus}
                onClick={() => {
                  setSubCategoryForm({
                    open: true,
                    data: {
                      categoryId: cat.id,
                      name: '',
                      description: '',
                    },
                  });
                }}
                style={{ 
                  fontSize: '12px', 
                  padding: '6px 12px',
                  width: '100%',
                }}
              >
                Add Subcategory
              </Button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    setEditingCategory(cat);
                    setCategoryForm({
                      open: true,
                      data: {
                        name: cat.name,
                        description: cat.description || '',
                      },
                    });
                  }}
                  style={{ 
                    fontSize: '12px', 
                    padding: '6px 12px',
                    border: 'none',
                    background: 'transparent',
                    color: '#2563eb',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontWeight: '500',
                    borderRadius: '6px',
                    transition: 'all 0.2s',
                    width: '50%',
                  }}
                  onMouseOver={(e) => {
                    e.target.style.background = '#eff6ff';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.background = 'transparent';
                  }}
                >
                  <Edit size={14} />
                  Edit
                </button>
                <Button
                  variant="danger"
                  icon={Trash2}
                  onClick={() => handleDeleteCategory(cat.id)}
                  style={{ 
                    fontSize: '12px', 
                    padding: '6px 12px',
                    width: '50%',
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsTab({ reports, filters, setFilters, staff, categories, showFilters, setShowFilters, onRefresh }) {
  const [tempFilters, setTempFilters] = useState(filters);
  const [staffDropdownOpen, setStaffDropdownOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [clientTypeDropdownOpen, setClientTypeDropdownOpen] = useState(false);
  const staffDropdownRef = useRef(null);
  const categoryDropdownRef = useRef(null);
  const clientTypeDropdownRef = useRef(null);

  // Initialize tempFilters when modal opens
  useEffect(() => {
    if (showFilters) {
      setTempFilters(filters);
    }
  }, [showFilters]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (staffDropdownRef.current && !staffDropdownRef.current.contains(event.target)) {
        setStaffDropdownOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setCategoryDropdownOpen(false);
      }
      if (clientTypeDropdownRef.current && !clientTypeDropdownRef.current.contains(event.target)) {
        setClientTypeDropdownOpen(false);
      }
    };

    if (staffDropdownOpen || categoryDropdownOpen || clientTypeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [staffDropdownOpen, categoryDropdownOpen, clientTypeDropdownOpen]);

  const clientTypes = ['REGULAR', 'SENIOR_CITIZEN', 'PWD', 'PREGNANT'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const clearFilters = () => {
    const today = new Date().toISOString().split('T')[0];
    const clearedFilters = {
      startDate: today,
      endDate: today,
      staffIds: [],
      categoryIds: [],
      clientTypes: [],
      startHour: '',
      endHour: '',
    };
    setFilters(clearedFilters);
    setTempFilters(clearedFilters);
  };

  const handleApplyFilters = () => {
    setFilters(tempFilters);
    setShowFilters(false);
  };

  const handleCancelFilters = () => {
    setTempFilters(filters); // Reset to current filters
    setShowFilters(false);
  };

  const hasActiveFilters = filters.staffIds.length > 0 || 
    filters.categoryIds.length > 0 || 
    filters.clientTypes.length > 0 || 
    filters.startHour || 
    filters.endHour;

  if (!reports) return <Loading />;

  const categoryData = reports.byCategory ?
    Object.entries(reports.byCategory).map(([name, value]) => ({ name, value })) : [];
  const clientTypeData = reports.byClientType ?
    Object.entries(reports.byClientType).map(([name, value]) => ({ name, value })) : [];
  const staffData = reports.byStaff ?
    Object.entries(reports.byStaff).map(([name, value]) => ({ name, value })) : [];
  const hourData = reports.byHour ?
    Object.entries(reports.byHour)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .map(([hour, value]) => ({ hour: `${hour}:00`, value })) : [];

  return (
    <div>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600' }}>Reports & Analytics</h2>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              style={{ 
                fontSize: '14px', 
                padding: '8px 16px',
                border: 'none',
                background: 'transparent',
                boxShadow: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#64748b',
                fontWeight: '500',
              }}
              onMouseOver={(e) => {
                e.target.style.color = '#1e293b';
              }}
              onMouseOut={(e) => {
                e.target.style.color = '#64748b';
              }}
            >
              <X size={16} />
              Clear Filters
            </button>
          )}
          <button
            onClick={() => setShowFilters(true)}
            style={{ 
              fontSize: '14px', 
              padding: '8px 16px',
              border: 'none',
              background: 'transparent',
              boxShadow: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: hasActiveFilters ? '#2563eb' : '#64748b',
              fontWeight: '500',
            }}
            onMouseOver={(e) => {
              e.target.style.color = '#2563eb';
            }}
            onMouseOut={(e) => {
              e.target.style.color = hasActiveFilters ? '#2563eb' : '#64748b';
            }}
          >
            <Filter size={16} />
            Filters
          </button>
        </div>
      </div>

      {showFilters && ReactDOM.createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
        }} onClick={handleCancelFilters} className="admin-modal-overlay">
          <div className="admin-modal-box" style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>Filter Reports</h3>
              <button
                onClick={handleCancelFilters}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>

          <div className="admin-filter-grid" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Row 1: Start Date 25%, End Date 25%, Staff 50% */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '20px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={tempFilters.startDate}
                  onChange={(e) => setTempFilters({ ...tempFilters, startDate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '2px solid #e2e8f0',
                    fontSize: '14px',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                  End Date
                </label>
                <input
                  type="date"
                  value={tempFilters.endDate}
                  onChange={(e) => setTempFilters({ ...tempFilters, endDate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '2px solid #e2e8f0',
                    fontSize: '14px',
                  }}
                />
              </div>
              <div style={{ position: 'relative' }} ref={staffDropdownRef}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                Staff
              </label>
              <div
                onClick={() => setStaffDropdownOpen(!staffDropdownOpen)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '2px solid #e2e8f0',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                {tempFilters.staffIds && tempFilters.staffIds.length > 0 ? (
                  tempFilters.staffIds.map((staffId) => {
                    const s = staff.find(st => st.id === staffId);
                    return s ? (
                      <span
                        key={staffId}
                        style={{
                          fontSize: '12px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          background: '#eff6ff',
                          color: '#2563eb',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setTempFilters({
                            ...tempFilters,
                            staffIds: tempFilters.staffIds.filter(id => id !== staffId),
                          });
                        }}
                      >
                        {s.name}
                        <X size={12} />
                      </span>
                    ) : null;
                  })
                ) : (
                  <span style={{ color: '#94a3b8' }}>Select staff...</span>
                )}
              </div>
              {staffDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    background: 'white',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 1000,
                    maxHeight: '200px',
                    overflowY: 'auto',
                  }}
                >
                  {staff.map((s) => {
                    const isSelected = tempFilters.staffIds?.includes(s.id) || false;
                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          const ids = tempFilters.staffIds || [];
                          if (isSelected) {
                            setTempFilters({
                              ...tempFilters,
                              staffIds: ids.filter(id => id !== s.id),
                            });
                          } else {
                            setTempFilters({
                              ...tempFilters,
                              staffIds: [...ids, s.id],
                            });
                          }
                        }}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          background: isSelected ? '#eff6ff' : 'white',
                          color: isSelected ? '#2563eb' : '#1e293b',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          borderBottom: '1px solid #f1f5f9',
                        }}
                        onMouseOver={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = '#f8fafc';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = 'white';
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          style={{ cursor: 'pointer' }}
                        />
                        <span>{s.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
            </div>

            {/* Row 2: Categories, Client Types */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'end' }}>
              <div style={{ position: 'relative' }} ref={categoryDropdownRef}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                  Categories
                </label>
              <div
                onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '2px solid #e2e8f0',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                {tempFilters.categoryIds && tempFilters.categoryIds.length > 0 ? (
                  tempFilters.categoryIds.map((catId) => {
                    const cat = categories.find(c => c.id === catId);
                    return cat ? (
                      <span
                        key={catId}
                        style={{
                          fontSize: '12px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          background: '#eff6ff',
                          color: '#2563eb',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setTempFilters({
                            ...tempFilters,
                            categoryIds: tempFilters.categoryIds.filter(id => id !== catId),
                          });
                        }}
                      >
                        {cat.name}
                        <X size={12} />
                      </span>
                    ) : null;
                  })
                ) : (
                  <span style={{ color: '#94a3b8' }}>Select categories...</span>
                )}
              </div>
              {categoryDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    background: 'white',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 1000,
                    maxHeight: '200px',
                    overflowY: 'auto',
                  }}
                >
                  {categories.map((cat) => {
                    const isSelected = tempFilters.categoryIds?.includes(cat.id) || false;
                    return (
                      <div
                        key={cat.id}
                        onClick={() => {
                          const ids = tempFilters.categoryIds || [];
                          if (isSelected) {
                            setTempFilters({
                              ...tempFilters,
                              categoryIds: ids.filter(id => id !== cat.id),
                            });
                          } else {
                            setTempFilters({
                              ...tempFilters,
                              categoryIds: [...ids, cat.id],
                            });
                          }
                        }}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          background: isSelected ? '#eff6ff' : 'white',
                          color: isSelected ? '#2563eb' : '#1e293b',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          borderBottom: '1px solid #f1f5f9',
                        }}
                        onMouseOver={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = '#f8fafc';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = 'white';
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          style={{ cursor: 'pointer' }}
                        />
                        <span>{cat.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              </div>

              {/* Client Type Filter */}
              <div style={{ position: 'relative' }} ref={clientTypeDropdownRef}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                  Client Types
                </label>
              <div
                onClick={() => setClientTypeDropdownOpen(!clientTypeDropdownOpen)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '2px solid #e2e8f0',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                {tempFilters.clientTypes && tempFilters.clientTypes.length > 0 ? (
                  tempFilters.clientTypes.map((type) => (
                    <span
                      key={type}
                      style={{
                        fontSize: '12px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: '#eff6ff',
                        color: '#2563eb',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTempFilters({
                          ...tempFilters,
                          clientTypes: tempFilters.clientTypes.filter(t => t !== type),
                        });
                      }}
                    >
                      {type.replace('_', ' ')}
                      <X size={12} />
                    </span>
                  ))
                ) : (
                  <span style={{ color: '#94a3b8' }}>Select client types...</span>
                )}
              </div>
              {clientTypeDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    background: 'white',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 1000,
                    maxHeight: '200px',
                    overflowY: 'auto',
                  }}
                >
                  {clientTypes.map((type) => {
                    const isSelected = tempFilters.clientTypes?.includes(type) || false;
                    return (
                      <div
                        key={type}
                        onClick={() => {
                          const types = tempFilters.clientTypes || [];
                          if (isSelected) {
                            setTempFilters({
                              ...tempFilters,
                              clientTypes: types.filter(t => t !== type),
                            });
                          } else {
                            setTempFilters({
                              ...tempFilters,
                              clientTypes: [...types, type],
                            });
                          }
                        }}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          background: isSelected ? '#eff6ff' : 'white',
                          color: isSelected ? '#2563eb' : '#1e293b',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          borderBottom: '1px solid #f1f5f9',
                        }}
                        onMouseOver={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = '#f8fafc';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = 'white';
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          style={{ cursor: 'pointer' }}
                        />
                        <span>{type.replace('_', ' ')}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
            </div>

            {/* Row 3: Start Hour, End Hour */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                  Start Hour (Peak Hours)
                </label>
                <Select
                  value={tempFilters.startHour}
                  onChange={(e) => setTempFilters({ ...tempFilters, startHour: e.target.value })}
                >
                  <option value="">All Hours</option>
                  {hours.map((hour) => (
                    <option key={hour} value={hour}>
                      {String(hour).padStart(2, '0')}:00
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
                  End Hour (Peak Hours)
                </label>
                <Select
                  value={tempFilters.endHour}
                  onChange={(e) => setTempFilters({ ...tempFilters, endHour: e.target.value })}
                >
                  <option value="">All Hours</option>
                  {hours.map((hour) => (
                    <option key={hour} value={hour}>
                      {String(hour).padStart(2, '0')}:00
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e2e8f0' }}>
            <Button
              variant="outline"
              icon={X}
              onClick={handleCancelFilters}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={Check}
              onClick={handleApplyFilters}
            >
              Apply Filters
            </Button>
          </div>
        </div>
        </div>,
        document.body
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}>
        <StatCard label="Total Served" value={reports.totalServed} />
        <StatCard label="Average Duration" value={`${Math.floor((reports.averageDuration || 0) / 60)}m ${(reports.averageDuration || 0) % 60}s`} />
      </div>

      <div className="admin-reports-grid" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
        marginBottom: '24px',
      }}>
        {categoryData.length > 0 && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}>
            <h3 style={{ marginBottom: '16px' }}>By Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {clientTypeData.length > 0 && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}>
            <h3 style={{ marginBottom: '16px' }}>By Client Type</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={clientTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {clientTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {hourData.length > 0 && (
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '24px',
        }}>
          <h3 style={{ marginBottom: '16px' }}>Peak Hours</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={hourData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {staffData.length > 0 && (
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          <h3 style={{ marginBottom: '16px' }}>By Staff</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={staffData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}function SettingsTab() {
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [currentLogo, setCurrentLogo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false });
  
  // Ding sound state
  const [dingFile, setDingFile] = useState(null);
  const [currentDing, setCurrentDing] = useState(null);
  const [uploadingDing, setUploadingDing] = useState(false);
  const [dingConfirmDialog, setDingConfirmDialog] = useState({ open: false });
  
  // TTS voices state
  const [ttsVoices, setTtsVoices] = useState([
    { id: '', name: '' },
    { id: '', name: '' },
    { id: '', name: '' },
  ]);
  const [activeVoiceId, setActiveVoiceId] = useState('');
  const [savingVoices, setSavingVoices] = useState(false);

  // TTS announcement template
  const [announcementTemplate, setAnnouncementTemplate] = useState('');
  const [savingAnnouncementTemplate, setSavingAnnouncementTemplate] = useState(false);

  // Video folder state
  const [videoFolderPath, setVideoFolderPath] = useState('');
  const [savingVideoFolder, setSavingVideoFolder] = useState(false);

  // Local tab state for settings subsections
  const [settingsView, setSettingsView] = useState('branding'); // 'branding' | 'audio' | 'videos'

  useEffect(() => {
    loadCurrentLogo();
    loadCurrentDing();
    loadTtsVoices();
    loadAnnouncementTemplate();
    loadVideoFolderPath();
  }, []);

  const loadCurrentLogo = async () => {
    try {
      const res = await api.get('/admin/settings/logo');
      if (res.data.logoUrl) {
        setCurrentLogo(res.data.logoUrl);
      }
    } catch (error) {
      console.error('Failed to load logo:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentDing = async () => {
    try {
      const res = await api.get('/admin/settings/ding-sound');
      if (res.data.dingSoundUrl) {
        setCurrentDing(res.data.dingSoundUrl);
      }
    } catch (error) {
      console.error('Failed to load ding sound:', error);
    }
  };

  const loadTtsVoices = async () => {
    try {
      const res = await api.get('/admin/settings/tts-voices');
      const voices = Array.isArray(res.data.voices) ? res.data.voices : [];
      const padded = [...voices];
      while (padded.length < 3) {
        padded.push({ id: '', name: '' });
      }
      setTtsVoices(padded.slice(0, 3));

      if (res.data.activeVoiceId) {
        setActiveVoiceId(res.data.activeVoiceId);
      } else if (voices[0]?.id) {
        setActiveVoiceId(voices[0].id);
      }
    } catch (error) {
      console.error('Failed to load TTS voices:', error);
    }
  };

  const loadAnnouncementTemplate = async () => {
    try {
      const res = await api.get('/admin/settings/tts-announcement');
      if (res.data.template) {
        setAnnouncementTemplate(res.data.template);
      }
    } catch (error) {
      console.error('Failed to load TTS announcement template:', error);
    }
  };

  const loadVideoFolderPath = async () => {
    try {
      const res = await api.get('/admin/settings/video-folder');
      if (res.data.videoFolderPath) {
        setVideoFolderPath(res.data.videoFolderPath);
      }
    } catch (error) {
      console.error('Failed to load video folder path:', error);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!logoFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', logoFile);

      const res = await api.post('/admin/settings/logo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setCurrentLogo(res.data.logoUrl);
      setLogoFile(null);
      setLogoPreview(null);
      toastSuccess('Logo uploaded successfully!');
    } catch (error) {
      console.error('Failed to upload logo:', error);
      toastError(error.response?.data?.error || 'Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    setConfirmDialog({
      open: true,
      title: 'Delete Logo',
      message: 'Are you sure you want to delete the current logo?',
      onConfirm: async () => {
        setConfirmDialog({ open: false });
        try {
          await api.delete('/admin/settings/logo');
          setCurrentLogo(null);
          setLogoFile(null);
          setLogoPreview(null);
          toastSuccess('Logo deleted successfully!');
        } catch (error) {
          console.error('Failed to delete logo:', error);
          toastError(error.response?.data?.error || 'Failed to delete logo');
        }
      },
      onCancel: () => setConfirmDialog({ open: false }),
    });
  };

  const handleDingFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setDingFile(file);
    }
  };

  const handleUploadDing = async (e) => {
    e.preventDefault();
    if (!dingFile) return;

    setUploadingDing(true);
    try {
      const formData = new FormData();
      formData.append('sound', dingFile);

      const res = await api.post('/admin/settings/ding-sound', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setCurrentDing(res.data.dingSoundUrl);
      setDingFile(null);
      toastSuccess('Ding sound uploaded successfully!');
    } catch (error) {
      console.error('Failed to upload ding sound:', error);
      toastError(error.response?.data?.error || 'Failed to upload ding sound');
    } finally {
      setUploadingDing(false);
    }
  };

  const handleDeleteDing = async () => {
    setDingConfirmDialog({
      open: true,
      title: 'Delete Ding Sound',
      message: 'Are you sure you want to delete the current ding sound?',
      onConfirm: async () => {
        setDingConfirmDialog({ open: false });
        try {
          await api.delete('/admin/settings/ding-sound');
          setCurrentDing(null);
          setDingFile(null);
          toastSuccess('Ding sound deleted successfully!');
        } catch (error) {
          console.error('Failed to delete ding sound:', error);
          toastError(error.response?.data?.error || 'Failed to delete ding sound');
        }
      },
      onCancel: () => setDingConfirmDialog({ open: false }),
    });
  };

  const handleSaveVideoFolder = async (e) => {
    e.preventDefault();
    if (!videoFolderPath.trim()) {
      toastError('Video folder path cannot be empty');
      return;
    }

    setSavingVideoFolder(true);
    try {
      await api.post('/admin/settings/video-folder', {
        videoFolderPath: videoFolderPath.trim(),
      });
      toastSuccess('Video folder path updated successfully!');
    } catch (error) {
      console.error('Failed to save video folder path:', error);
      toastError(error.response?.data?.error || 'Failed to save video folder path');
    } finally {
      setSavingVideoFolder(false);
    }
  };

  const handlePreviewVoice = async (rowVoiceId) => {
    const voiceId = typeof rowVoiceId === 'string' ? rowVoiceId.trim() : '';
    if (!voiceId) {
      toastError('Please enter a voice ID first');
      return;
    }

    const previewText =
      'Window 1 will now serve number 123, or John Doe.';

    try {
      const response = await api.post(
        '/tts',
        { text: previewText, voiceId },
        { responseType: 'arraybuffer' }
      );
      const audioData = response.data;
      if (!audioData) return;

      const blob = new Blob([audioData], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      audio.play().catch((err) => {
        console.error('Failed to play preview TTS audio:', err);
      }).finally(() => {
        URL.revokeObjectURL(url);
      });
    } catch (error) {
      console.error('Failed to preview TTS voice:', error);
      toastError('Failed to preview this voice. Please check your ElevenLabs settings.');
    }
  };

  const handleVoiceFieldChange = (index, field, value) => {
    setTtsVoices((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return next;
    });
  };

  const handleSaveVoices = async (e) => {
    e.preventDefault();
    setSavingVoices(true);
    try {
      const payloadVoices = ttsVoices
        .map((v) => ({
          id: (v.id || '').trim(),
          name: (v.name || '').trim(),
        }))
        .filter((v) => v.id);

      if (payloadVoices.length === 0) {
        toastError('Please enter at least one ElevenLabs voice ID');
        setSavingVoices(false);
        return;
      }

      const selectedActiveId =
        activeVoiceId && payloadVoices.some((v) => v.id === activeVoiceId)
          ? activeVoiceId
          : payloadVoices[0].id;

      const res = await api.post('/admin/settings/tts-voices', {
        voices: payloadVoices,
        activeVoiceId: selectedActiveId,
      });

      const savedVoices = Array.isArray(res.data.voices) ? res.data.voices : payloadVoices;
      const padded = [...savedVoices];
      while (padded.length < 3) {
        padded.push({ id: '', name: '' });
      }
      setTtsVoices(padded.slice(0, 3));
      setActiveVoiceId(res.data.activeVoiceId || selectedActiveId);

      toastSuccess('TTS voices updated successfully!');
    } catch (error) {
      console.error('Failed to save TTS voices:', error);
      toastError(error.response?.data?.error || 'Failed to save TTS voices');
    } finally {
      setSavingVoices(false);
    }
  };

  const handleSaveAnnouncementTemplate = async (e) => {
    e.preventDefault();
    const value = (announcementTemplate || '').trim();
    if (!value) {
      toastError('Announcement template cannot be empty');
      return;
    }

    setSavingAnnouncementTemplate(true);
    try {
      await api.post('/admin/settings/tts-announcement', { template: value });
      toastSuccess('Announcement template updated successfully!');
    } catch (error) {
      console.error('Failed to save announcement template:', error);
      toastError(error.response?.data?.error || 'Failed to save announcement template');
    } finally {
      setSavingAnnouncementTemplate(false);
    }
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div>
      <ConfirmDialog {...confirmDialog} />
      <ConfirmDialog {...dingConfirmDialog} />
      <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
        Settings
      </h2>

      {/* Settings subtabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '4px',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'branding', label: 'Branding' },
          { id: 'audio', label: 'Audio & TTS' },
          { id: 'videos', label: 'Videos' },
        ].map((tab) => {
          const isActive = settingsView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSettingsView(tab.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '9999px',
                border: 'none',
                backgroundColor: isActive ? '#1d4ed8' : 'transparent',
                color: isActive ? '#ffffff' : '#475569',
                fontSize: '14px',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                boxShadow: isActive ? '0 1px 3px rgba(15, 23, 42, 0.25)' : 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* BRANDING TAB */}
      {settingsView === 'branding' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            borderTop: '3px solid #2563eb',
          }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
          Logo
        </h3>
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>
          Upload a logo to display across all pages. Supported formats: JPG, PNG, GIF, SVG, WebP (max 5MB)
        </p>

        {currentLogo && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
              Current Logo:
            </div>
            <img
              src={currentLogo}
              alt="Current logo"
              style={{
                maxWidth: '200px',
                maxHeight: '100px',
                objectFit: 'contain',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '8px',
              }}
            />
          </div>
        )}

        <form onSubmit={handleUpload}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
            }}>
              Upload New Logo
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{
                width: '100%',
                padding: '8px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
              }}
            />
          </div>

          {logoPreview && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                Preview:
              </div>
              <img
                src={logoPreview}
                alt="Preview"
                style={{
                  maxWidth: '200px',
                  maxHeight: '100px',
                  objectFit: 'contain',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '8px',
                }}
              />
            </div>
          )}

          <div className="admin-settings-buttons" style={{ display: 'flex', gap: '8px' }}>
            <Button type="submit" disabled={!logoFile || uploading}>
              {uploading ? 'Uploading...' : 'Upload Logo'}
            </Button>
            {currentLogo && (
              <Button variant="danger" onClick={handleDelete}>
                Delete Logo
              </Button>
            )}
          </div>
        </form>
          </div>
        </div>
      )}

      {/* AUDIO & TTS TAB */}
      {settingsView === 'audio' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            borderTop: '3px solid #f97316',
          }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
          Ding Sound (Announcement Chime)
        </h3>
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>
          Upload a short audio file to play before each queue announcement on the public monitoring page.
          Supported formats: MP3, WAV, OGG, M4A, AAC (max 2MB). Keep it brief (under 2 seconds) for best results.
        </p>

        {currentDing && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
              Current Ding Sound:
            </div>
            <audio controls src={currentDing} style={{ width: '100%', maxWidth: '400px' }}>
              Your browser does not support the audio element.
            </audio>
          </div>
        )}

        <form onSubmit={handleUploadDing}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
            }}>
              Upload New Ding Sound
            </label>
            <input
              type="file"
              accept="audio/*"
              onChange={handleDingFileChange}
              style={{
                width: '100%',
                padding: '8px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
              }}
            />
          </div>

<div className="admin-settings-buttons" style={{ display: 'flex', gap: '8px' }}>
              <Button type="submit" disabled={!dingFile || uploadingDing}>
                {uploadingDing ? 'Uploading...' : 'Upload Ding Sound'}
              </Button>
              {currentDing && (
                <Button variant="danger" onClick={handleDeleteDing}>
                  Delete Ding Sound
                </Button>
              )}
            </div>
        </form>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            borderTop: '3px solid #0ea5e9',
          }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
          Announcement Message Template
        </h3>
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px' }}>
          Control what the voice will say when announcing a new client. You can use the following
          placeholders, which will be replaced automatically:
        </p>
        <ul style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', paddingLeft: '20px' }}>
          <li><code style={{ fontFamily: 'monospace' }}>{"{{window}}"}</code> — window label (e.g. Window 1)</li>
          <li><code style={{ fontFamily: 'monospace' }}>{"{{queueNumber}}"}</code> — queue number counter (e.g. 6)</li>
          <li><code style={{ fontFamily: 'monospace' }}>{"{{clientName}}"}</code> — client name (may be empty)</li>
          <li><code style={{ fontFamily: 'monospace' }}>{"{{clientNamePart}}"}</code> — expands to <code>, or client name John Doe</code> when a name exists, or nothing otherwise</li>
        </ul>

        <form onSubmit={handleSaveAnnouncementTemplate}>
          <textarea
            value={announcementTemplate}
            onChange={(e) => setAnnouncementTemplate(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '8px',
              border: '2px solid #e2e8f0',
              fontSize: '14px',
              fontFamily: 'monospace',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
            placeholder='Window {{window}} will now serve queue number {{queueNumber}}{{clientNamePart}}.'
          />

          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <Button type="submit" disabled={savingAnnouncementTemplate}>
              {savingAnnouncementTemplate ? 'Saving Template...' : 'Save Template'}
            </Button>
          </div>
        </form>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            borderTop: '3px solid #10b981',
          }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
          Text-to-Speech Voices (ElevenLabs)
        </h3>
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
          Configure up to three ElevenLabs voice IDs and choose which one is active for queue announcements.
          Voice IDs can be copied from your ElevenLabs dashboard.
        </p>

        <form onSubmit={handleSaveVoices}>
          {ttsVoices.map((voice, index) => (
            <div
              key={index}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.4fr) auto',
                gap: '12px',
                marginBottom: '12px',
                alignItems: 'center',
              }}
            >
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '500' }}>
                  Voice {index + 1} Name (optional)
                </label>
                <input
                  type="text"
                  value={voice.name || ''}
                  onChange={(e) => handleVoiceFieldChange(index, 'name', e.target.value)}
                  placeholder="e.g. Front Desk Female"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '2px solid #e2e8f0',
                    fontSize: '14px',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '500' }}>
                  Voice {index + 1} ID
                </label>
                <input
                  type="text"
                  value={voice.id || ''}
                  onChange={(e) => handleVoiceFieldChange(index, 'id', e.target.value)}
                  placeholder="ElevenLabs voice ID"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '2px solid #e2e8f0',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => handlePreviewVoice(voice.id)}
                  disabled={!voice.id}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: voice.id ? '#eff6ff' : '#f8fafc',
                    color: voice.id ? '#2563eb' : '#94a3b8',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: voice.id ? 'pointer' : 'not-allowed',
                  }}
                >
                  Preview Voice
                </button>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  <input
                    type="radio"
                    name="activeVoice"
                    checked={!!voice.id && activeVoiceId === voice.id}
                    disabled={!voice.id}
                    onChange={() => {
                      if (voice.id) {
                        setActiveVoiceId(voice.id);
                      }
                    }}
                  />
                  Active
                </label>
              </div>
            </div>
          ))}

          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <Button type="submit" disabled={savingVoices}>
              {savingVoices ? 'Saving Voices...' : 'Save Voices'}
            </Button>
          </div>
        </form>
          </div>
        </div>
      )}

      {/* VIDEOS TAB */}
      {settingsView === 'videos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            borderTop: '3px solid #6366f1',
          }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
          Video Folder Path
        </h3>
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>
          Configure the local folder path where video files are stored. The system will scan this folder for video files (mp4, webm, ogg, mov, avi) to play on the public monitoring page.
        </p>

        <form onSubmit={handleSaveVideoFolder}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
            }}>
              Video Folder Path
            </label>
            <input
              type="text"
              value={videoFolderPath}
              onChange={(e) => setVideoFolderPath(e.target.value)}
              placeholder="C:\\Users\\username\\videos or /Users/username/videos or videos"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '2px solid #e2e8f0',
                fontSize: '14px',
                fontFamily: 'monospace',
                backgroundColor: '#f8fafc',
                color: '#1e293b',
                transition: 'all 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#2563eb';
                e.target.style.backgroundColor = '#ffffff';
                e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.backgroundColor = '#f8fafc';
                e.target.style.boxShadow = 'none';
              }}
            />
            <p style={{ 
              fontSize: '12px', 
              color: '#64748b', 
              marginTop: '8px',
              marginBottom: 0,
            }}>
              Enter an absolute path (Windows: <code style={{ fontFamily: 'monospace', fontSize: '11px', background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px' }}>C:\Users\username\videos</code> or Mac/Linux: <code style={{ fontFamily: 'monospace', fontSize: '11px', background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px' }}>/Users/username/videos</code>) or a relative path from the backend directory (e.g., <code style={{ fontFamily: 'monospace', fontSize: '11px', background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px' }}>videos</code>)
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <Button type="submit" disabled={savingVideoFolder || !videoFolderPath.trim()}>
              {savingVideoFolder ? 'Saving...' : 'Save Video Folder Path'}
            </Button>
          </div>
        </form>
          </div>
        </div>
      )}
    </div>
  );
}
