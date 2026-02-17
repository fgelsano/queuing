import jwt from 'jsonwebtoken';

const STAFF_LOGOUT_HOUR = 18; // 6pm
const TIMEZONE = 'Asia/Manila';

const MANILA_UTC_OFFSET_HOURS = 8;

export function getHourInManila() {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      hour: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const hourPart = parts.find((p) => p.type === 'hour');
    const hour = parseInt(hourPart?.value ?? '0', 10);
    if (Number.isFinite(hour) && hour >= 0 && hour <= 23) return hour;
  } catch (e) {
    console.warn('[auth] Intl timezone failed, using UTC+8 fallback:', e.message);
  }
  // Fallback: Manila is UTC+8 (no DST)
  const now = new Date();
  let manilaHour = now.getUTCHours() + MANILA_UTC_OFFSET_HOURS;
  if (manilaHour >= 24) manilaHour -= 24;
  if (manilaHour < 0) manilaHour += 24;
  return manilaHour;
}

export function isPastStaffLogoutTime() {
  return getHourInManila() >= STAFF_LOGOUT_HOUR;
}

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    if (user.role === 'STAFF' && isPastStaffLogoutTime()) {
      return res.status(401).json({
        error: 'Automatic logout: staff sessions end at 6pm',
        code: 'STAFF_LOGOUT_6PM',
      });
    }
    req.user = user;
    next();
  });
};

export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

export const requireStaff = (req, res, next) => {
  if (req.user.role !== 'STAFF' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Staff access required' });
  }
  next();
};
