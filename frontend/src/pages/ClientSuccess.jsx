import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { getQueueEntry, clearQueueEntry, saveQueueEntry } from '../utils/queueStorage';
import { getQueueCounter } from '../utils/queueNumber';
import WindowCard from '../components/WindowCard';
import ClientTypeBadge from '../components/ClientTypeBadge';
import Loading from '../components/Loading';
import Logo from '../components/Logo';

export default function ClientSuccess() {
  const navigate = useNavigate();
  const [queueEntry, setQueueEntry] = useState(null);
  const [windows, setWindows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [peopleAhead, setPeopleAhead] = useState(0);

  useEffect(() => {
    const stored = getQueueEntry();
    if (!stored) {
      navigate('/');
      return;
    }

    setQueueEntry(stored);
    loadData();
    const interval = setInterval(loadData, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [navigate]);

  // Redirect to thank you page when status becomes SERVED
  useEffect(() => {
    if (queueEntry?.status === 'SERVED') {
      navigate('/thank-you');
    }
  }, [queueEntry?.status, navigate]);

  const loadData = async () => {
    try {
      // Always read the latest stored entry so polling continues to work
      // even though the interval callback closes over an older React render.
      const currentEntry = getQueueEntry() || queueEntry;

      // Load queue entry from server
      if (currentEntry?.queueNumber) {
        const res = await api.get(`/queue/${currentEntry.queueNumber}`);
        const entry = res.data.queueEntry;
        
        // Update stored entry
        const updated = {
          ...currentEntry,
          status: entry.status,
        };
        setQueueEntry(updated);
        saveQueueEntry(updated);

        // Redirect to thank you page if served
        if (entry.status === 'SERVED') {
          navigate('/thank-you');
          return;
        }

        // Calculate people ahead
        if (entry.status === 'WAITING') {
          try {
            const aheadRes = await api.get(`/queue/${currentEntry.queueNumber}/ahead`);
            setPeopleAhead(aheadRes.data.peopleAhead || 0);
          } catch (error) {
            // Fallback to total waiting count if specific endpoint fails
            const allWaiting = await api.get('/queue/public/stats');
            setPeopleAhead(allWaiting.data.waiting || 0);
          }
        } else {
          setPeopleAhead(0);
        }
      }

      // Load windows
      const windowsRes = await api.get('/queue/public/windows');
      setWindows(windowsRes.data.windows);
    } catch (error) {
      console.error('Failed to load data:', error);
      if (error.response?.status === 404) {
        clearQueueEntry();
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading || !queueEntry) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loading />
      </div>
    );
  }

  const statusColors = {
    WAITING: { bg: '#fef3c7', color: '#92400e', text: 'Waiting' },
    // When staff moves this queue number to NOW_SERVING,
    // show \"Being served\" on the success page.
    NOW_SERVING: { bg: '#dbeafe', color: '#1e40af', text: 'Being served' },
    SERVED: { bg: '#d1fae5', color: '#065f46', text: 'Served' },
    SKIPPED: { bg: '#fee2e2', color: '#991b1b', text: 'Skipped' },
  };

  const status = statusColors[queueEntry.status] || statusColors.WAITING;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '20px',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
          <Logo size="medium" />
        </div>
        
        {/* Header */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '32px',
          marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: '14px',
            color: '#64748b',
            marginBottom: '8px',
          }}>
            Hello, {queueEntry.clientName}
          </div>
          <div style={{
            fontSize: '48px',
            fontWeight: '700',
            color: '#2563eb',
            marginBottom: '16px',
            letterSpacing: '2px',
          }}>
            {getQueueCounter(queueEntry.queueNumber)}
          </div>
          <div style={{
            display: 'inline-block',
            padding: '8px 16px',
            borderRadius: '20px',
            backgroundColor: status.bg,
            color: status.color,
            fontSize: '14px',
            fontWeight: '600',
            marginBottom: '16px',
          }}>
            {status.text}
          </div>
          <div style={{
            marginTop: '16px',
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}>
            <ClientTypeBadge clientType={queueEntry.clientType} />
            <span style={{
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '600',
              backgroundColor: '#e2e8f0',
              color: '#475569',
            }}>
              {queueEntry.category}
              {queueEntry.subCategory && ` - ${queueEntry.subCategory}`}
            </span>
          </div>
          {queueEntry.status === 'WAITING' && peopleAhead > 0 && (
            <div style={{
              marginTop: '16px',
              fontSize: '14px',
              color: '#64748b',
            }}>
              Approximately {peopleAhead} {peopleAhead === 1 ? 'person' : 'people'} ahead
            </div>
          )}
          <div style={{
            marginTop: '24px',
            padding: '16px',
            background: '#f1f5f9',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#475569',
          }}>
            💡 You can leave and monitor your queue status from this page. We'll update automatically.
          </div>
        </div>

        {/* Active Windows */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            marginBottom: '16px',
            color: '#1e293b',
          }}>
            Active Windows
          </h2>
          <div
            className="grid-responsive"
            style={{
              display: 'grid',
              gap: '16px',
            }}
          >
            {windows.length > 0 ? (
              windows.map((window) => (
                <WindowCard key={window.id} window={window} />
              ))
            ) : (
              <div style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: '40px',
                background: 'white',
                borderRadius: '12px',
                color: '#64748b',
              }}>
                No active windows at the moment
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
