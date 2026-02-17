import { getQueueCounter } from '../utils/queueNumber';

function formatClientType(type) {
  if (!type) return '';
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export default function WindowCard({ window, compact = false }) {
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
        background: '#0b1120',
        borderRadius: '12px',
        padding: 0,
        boxShadow: '0 4px 12px rgba(15,23,42,0.6)',
        border: '1px solid #1e293b',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'stretch',
        minHeight: compact ? 0 : '96px',
        flex: 1,
        overflow: 'hidden',
      }}
    >
      {/* Left: Staff profile picture with window number overlay at bottom */}
      <div
        style={{
          flex: compact ? '0 0 28%' : '0 0 34%',
          maxWidth: compact ? '70px' : '110px',
          minHeight: 0,
          overflow: 'hidden',
          borderRadius: '12px',
          background: staff?.profilePicture
            ? undefined
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
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
              minHeight: 0,
            }}
          />
        ) : (
          <span
            style={{
              color: 'white',
              fontWeight: '700',
              fontSize: compact ? '18px' : '24px',
            }}
          >
            {getInitials(staffName)}
          </span>
        )}
        {/* Window number overlay at bottom of staff picture */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: compact ? '2px 4px' : '4px 6px',
            background: 'rgba(0,0,0,0.65)',
            color: '#38bdf8',
            fontSize: compact ? '12px' : '16px',
            fontWeight: '700',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </div>
      </div>

      {/* Right: Text block */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          padding: compact ? '4px 6px 4px 6px' : '6px 8px 6px 8px',
        }}
      >
        {/* Staff name - allow 2 lines to avoid cut-off */}
        <div
          style={{
            fontSize: compact ? '13px' : '18px',
            fontWeight: '700',
            color: '#e5e7eb',
            marginBottom: '2px',
            lineHeight: 1.2,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {staffName}
        </div>

        {currentServing ? (
          <>
            <div
              style={{
                fontSize: compact ? '9px' : '11px',
                fontWeight: '700',
                color: '#cbd5f5',
                marginBottom: '2px',
              }}
            >
              is now serving:
            </div>
            <div
              style={{
                fontSize: compact ? 'clamp(18px, 2.8vh, 28px)' : 'clamp(28px, 3.5vw, 44px)',
                fontWeight: '700',
                color: '#fbbf24',
                lineHeight: 1.05,
                marginBottom: '4px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {queueDisplay}
            </div>
            {clientLine && (
              <div
                style={{
                  marginTop: 'auto',
                  paddingTop: '4px',
                  fontSize: compact ? '10px' : '13px',
                  fontWeight: '600',
                  color: '#cbd5f5',
                  lineHeight: 1.2,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {clientLine}
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              fontSize: compact ? '9px' : '11px',
              fontWeight: '600',
              color: '#64748b',
              fontStyle: 'italic',
            }}
          >
            No active service
          </div>
        )}
      </div>
    </div>
  );
}
