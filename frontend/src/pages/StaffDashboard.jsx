import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Play, CheckCircle, XCircle, SkipForward } from 'lucide-react';
import api from '../utils/api';
import Button from '../components/Button';
import ClientTypeBadge from '../components/ClientTypeBadge';
import Loading from '../components/Loading';
import Select from '../components/Select';
import Logo from '../components/Logo';
import StaffProfileDropdown from '../components/StaffProfileDropdown';
import { toastSuccess, toastError } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444'];

export default function StaffDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [window, setWindow] = useState(null);
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({});
  const [windows, setWindows] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [dateRange, setDateRange] = useState('today');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!token || user?.role !== 'STAFF') {
      navigate('/staff/login');
      return;
    }

    loadDashboard();
    loadWindows();
    const interval = setInterval(loadDashboard, 3000);
    return () => clearInterval(interval);
  }, [navigate]);

  useEffect(() => {
    if (dateRange) {
      loadAnalytics();
    }
  }, [dateRange]);

  const loadDashboard = async () => {
    try {
      const res = await api.get('/staff/dashboard');
      setWindow(res.data.window);
      setQueue(res.data.queue || []);
      setStats(res.data.stats || {});
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      if (error.response?.status === 401) {
        navigate('/staff/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadWindows = async () => {
    try {
      const res = await api.get('/windows/active');
      setWindows(res.data.windows || []);
    } catch (error) {
      console.error('Failed to load windows:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      let startDate, endDate;
      const today = new Date();
      
      if (dateRange === 'today') {
        startDate = today.toISOString().split('T')[0];
        endDate = startDate;
      } else if (dateRange === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = yesterday.toISOString().split('T')[0];
        endDate = startDate;
      } else {
        // Custom range - for now, default to today
        startDate = today.toISOString().split('T')[0];
        endDate = startDate;
      }

      const res = await api.get(`/staff/analytics?startDate=${startDate}&endDate=${endDate}`);
      setAnalytics(res.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  const handleAssignWindow = async (windowId) => {
    try {
      await api.post('/staff/assign-window', { windowId });
      loadDashboard();
      loadWindows();
    } catch (error) {
      console.error('Failed to assign window:', error);
      alert(error.response?.data?.error || 'Failed to assign window');
    }
  };

  const handleServe = async (queueEntryId) => {
    try {
      await api.post(`/staff/serve/${queueEntryId}`);
      loadDashboard();
    } catch (error) {
      console.error('Failed to start serving:', error);
      if (error.response?.status === 409) {
        toastError(error.response?.data?.error || 'Client was already claimed. Refreshing...');
        loadDashboard();
      } else {
        toastError(error.response?.data?.error || 'Failed to start serving');
      }
    }
  };

  const handleComplete = async (queueEntryId) => {
    try {
      await api.post(`/staff/complete/${queueEntryId}`);
      loadDashboard();
      loadAnalytics();
    } catch (error) {
      console.error('Failed to complete:', error);
      alert(error.response?.data?.error || 'Failed to complete');
    }
  };

  const handleSkip = async (queueEntryId) => {
    if (!window.confirm('Mark this client as skipped?')) return;
    
    try {
      await api.post(`/staff/skip/${queueEntryId}`);
      loadDashboard();
    } catch (error) {
      console.error('Failed to skip:', error);
      alert(error.response?.data?.error || 'Failed to skip');
    }
  };

  const handleLogout = async () => {
    try {
      // Deactivate all window assignments for this staff
      const windowAssignment = await api.get('/staff/dashboard').then(res => res.data.window);
      if (windowAssignment) {
        await api.post('/staff/assign-window', { windowId: null });
      }
    } catch (error) {
      console.error('Error deactivating window on logout:', error);
    }
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/staff/login');
  };

  const handleProfileClick = () => {
    navigate('/staff/profile');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loading />
      </div>
    );
  }

  // Separate priority and regular clients
  const priorityClients = queue.filter(q => 
    ['SENIOR_CITIZEN', 'PWD', 'PREGNANT'].includes(q.clientType)
  );
  const regularClients = queue.filter(q => q.clientType === 'REGULAR');

  // Prepare chart data
  const categoryData = analytics?.byCategory ? 
    Object.entries(analytics.byCategory).map(([name, value]) => ({ name, value })) : [];
  const clientTypeData = analytics?.byClientType ?
    Object.entries(analytics.byClientType).map(([name, value]) => ({ name, value })) : [];

  return (
    <>
      <style>{`
        .staff-dashboard-root {
          padding-left: env(safe-area-inset-left);
          padding-right: env(safe-area-inset-right);
        }
        .staff-dashboard-content {
          padding-left: max(24px, env(safe-area-inset-left));
          padding-right: max(24px, env(safe-area-inset-right));
        }
        .queue-item-buttons button {
          min-height: 44px;
        }
        @media (max-width: 768px) {
          .staff-dashboard-header {
            flex-wrap: wrap;
            gap: 12px;
            padding: 12px 16px !important;
            padding-left: max(16px, env(safe-area-inset-left)) !important;
            padding-right: max(16px, env(safe-area-inset-right)) !important;
          }
          .staff-dashboard-header > div:first-child {
            width: 100%;
            flex-direction: column;
            align-items: flex-start !important;
            gap: 8px !important;
          }
          .staff-dashboard-header-center {
            width: 100%;
            text-align: left;
          }
          .staff-dashboard-main-grid {
            grid-template-columns: 1fr !important;
          }
          .staff-dashboard-content {
            padding: 16px !important;
            padding-left: max(16px, env(safe-area-inset-left)) !important;
            padding-right: max(16px, env(safe-area-inset-right)) !important;
          }
          .queue-item-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          .queue-item-buttons {
            flex-direction: row !important;
            width: 100% !important;
            flex-wrap: wrap;
          }
          .queue-item-buttons button {
            flex: 1;
            min-width: 120px;
          }
          .staff-window-assign-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 480px) {
          .queue-item-buttons {
            flex-direction: column !important;
          }
          .queue-item-buttons button {
            min-width: 100%;
          }
        }
        @media (max-width: 1024px) and (min-width: 769px) {
          .staff-dashboard-main-grid {
            grid-template-columns: 60% 40% !important;
          }
        }
      `}</style>
      <div className="staff-dashboard-root" style={{
        minHeight: '100vh',
        background: '#f8fafc',
      }}>
        {/* Header */}
        <div className="staff-dashboard-header" style={{
          background: 'white',
          borderBottom: '1px solid #e2e8f0',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1 }}>
            <Logo size="small" />
            {window && (
              <div className="staff-dashboard-header-center" style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>
                Operating: {window.label}
              </div>
            )}
          </div>
          <StaffProfileDropdown
            onProfileClick={handleProfileClick}
            onLogout={handleLogout}
          />
        </div>

        <div className="staff-dashboard-content" style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '24px',
        }}>
          {/* Window Assignment */}
          {!window && (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '24px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
                Assign Window
              </h2>
              <div className="staff-window-assign-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '12px',
              }}>
                {windows.map((w) => (
                  <Button
                    key={w.id}
                    onClick={() => handleAssignWindow(w.id)}
                    variant="outline"
                  >
                    {w.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="staff-dashboard-main-grid" style={{
            display: 'grid',
            gridTemplateColumns: '75% 25%',
            gap: '24px',
          }}>
          {/* Queue List - First Column (75%) */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>
              Queue ({queue.length})
            </h2>

            {priorityClients.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#f59e0b',
                  marginBottom: '12px',
                }}>
                  Priority Clients
                </div>
                {priorityClients.map((entry) => (
                  <QueueItem
                    key={entry.id}
                    entry={entry}
                    onServe={handleServe}
                    onComplete={handleComplete}
                    onSkip={handleSkip}
                  />
                ))}
              </div>
            )}

            {regularClients.length > 0 && (
              <div>
                {priorityClients.length > 0 && (
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#64748b',
                    marginBottom: '12px',
                  }}>
                    Regular Clients
                  </div>
                )}
                {regularClients.map((entry) => (
                  <QueueItem
                    key={entry.id}
                    entry={entry}
                    onServe={handleServe}
                    onComplete={handleComplete}
                    onSkip={handleSkip}
                  />
                ))}
              </div>
            )}

            {queue.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                color: '#94a3b8',
              }}>
                No clients in queue
              </div>
            )}
          </div>

          {/* Second Column (25%) - Stats and Analytics stacked */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}>
            {/* Stats Summary Cards */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}>
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}>
                <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
                  In Queue
                </div>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#f59e0b' }}>
                  {queue.length}
                </div>
              </div>
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}>
                <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
                  Total Served Today
                </div>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#2563eb' }}>
                  {stats.totalServed || 0}
                </div>
              </div>
            </div>

            {/* Analytics */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
              }}>
                <h2 style={{ fontSize: '20px', fontWeight: '600' }}>
                  Analytics
                </h2>
                <Select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                </Select>
              </div>

            {analytics && (
              <>
                {categoryData.length > 0 && (
                  <div style={{ marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                      By Category
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
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
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                      By Client Type
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={clientTypeData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
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
              </>
            )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}

function QueueItem({ entry, onServe, onComplete, onSkip }) {
  const isServing = entry.status === 'NOW_SERVING';

  return (
    <div className="queue-item-grid" style={{
      padding: '16px',
      border: isServing ? '2px solid #2563eb' : '1px solid #e2e8f0',
      borderRadius: '8px',
      marginBottom: '12px',
      background: isServing ? '#eff6ff' : 'white',
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: '20px',
      alignItems: 'start',
    }}>
      <div>
        <div style={{
          fontSize: '18px',
          fontWeight: '700',
          color: '#2563eb',
          marginBottom: '4px',
        }}>
          {entry.queueNumber}
        </div>
        <div style={{ fontSize: '14px', color: '#1e293b', marginBottom: '4px' }}>
          {entry.clientName}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
          <ClientTypeBadge clientType={entry.clientType} />
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            {(entry.concernCategories?.length ? entry.concernCategories : entry.category ? [entry.category] : []).map((c) => c?.name).filter(Boolean).join(', ')}
            {((entry.concernSubCategories?.length ? entry.concernSubCategories : entry.subCategory ? [entry.subCategory] : []).map((s) => s?.name).filter(Boolean).length > 0) && ` - ${(entry.concernSubCategories?.length ? entry.concernSubCategories : [entry.subCategory]).map((s) => s?.name).filter(Boolean).join(', ')}`}
          </span>
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
          Joined: {new Date(entry.joinedAt).toLocaleTimeString()}
        </div>
      </div>
      <div className="queue-item-buttons" style={{ 
        display: 'flex', 
        gap: '8px', 
        flexDirection: 'column',
      }}>
        {!isServing ? (
          <Button
            variant="primary"
            icon={Play}
            onClick={() => onServe(entry.id)}
            style={{ fontSize: '12px', padding: '8px 16px', whiteSpace: 'nowrap' }}
          >
            Start Serving
          </Button>
        ) : (
          <Button
            variant="success"
            icon={CheckCircle}
            onClick={() => onComplete(entry.id)}
            style={{ fontSize: '12px', padding: '8px 16px', whiteSpace: 'nowrap' }}
          >
            Mark as Served
          </Button>
        )}
        <Button
          variant="danger"
          icon={SkipForward}
          onClick={() => onSkip(entry.id)}
          style={{ fontSize: '12px', padding: '8px 16px', whiteSpace: 'nowrap' }}
        >
          Skip
        </Button>
      </div>
    </div>
  );
}
