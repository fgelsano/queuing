import { getQueueCounter } from '../utils/queueNumber';

function formatClientType(type) {
  if (!type) return '';
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export default function WindowCard({ window }) {
  const { label, staff, currentServing } = window;

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const staffName = staff?.name || '—';
  const queueDisplay = currentServing
    ? getQueueCounter(currentServing.queueNumber)
    : null;
  const clientLine = currentServing
    ? ([
        currentServing.clientName || '',
        currentServing.clientType
          ? `(${formatClientType(currentServing.clientType)})`
          : '',
      ]
        .filter(Boolean)
        .join(' ')
        .trim() || null)
    : null;

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: '2px solid #e2e8f0',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'stretch',
        gap: '20px',
        minHeight: '180px',
      }}
    >
      {/* Left: Staff profile picture (~35–40% width) */}
      <div
        style={{
          flex: '0 0 38%',
          maxWidth: '200px',
          borderRadius: '12px',
          overflow: 'hidden',
          background: staff?.profilePicture
            ? undefined
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {staff?.profilePicture ? (
          <img
            src={staff.profilePicture}
            alt={staffName}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <span
            style={{
              color: 'white',
              fontWeight: '700',
              fontSize: '32px',
            }}
          >
            {getInitials(staffName)}
          </span>
        )}
      </div>

      {/* Right: Text block */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {/* Staff name */}
        <div
          style={{
            fontSize: '26px',
            fontWeight: '700',
            color: '#1e293b',
            marginBottom: '4px',
          }}
        >
          {staffName}
        </div>

        {currentServing ? (
          <>
            <div
              style={{
                fontSize: '22px',
                fontWeight: '700',
                color: '#1e293b',
                marginBottom: '8px',
              }}
            >
              is now serving:
            </div>
            <div
              style={{
                fontSize: 'clamp(48px, 8vw, 84px)',
                fontWeight: '700',
                color: '#1e293b',
                lineHeight: 1.1,
                marginBottom: '8px',
              }}
            >
              {queueDisplay}
            </div>
            {clientLine && (
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#475569',
                  marginBottom: '8px',
                }}
              >
                {clientLine}
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#94a3b8',
              fontStyle: 'italic',
            }}
          >
            No active service
          </div>
        )}

        {/* Window number at bottom */}
        <div
          style={{
            marginTop: 'auto',
            paddingTop: '12px',
            fontSize: '32px',
            fontWeight: '700',
            color: '#1e293b',
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}
