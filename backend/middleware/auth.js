import jwt from 'jsonwebtoken';

const STAFF_LOGOUT_HOUR = 18; // 6pm
const TIMEZONE = 'Asia/Manila';

export function getHourInManila() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const hourPart = parts.find((p) => p.type === 'hour');
  return parseInt(hourPart?.value ?? '0', 10) || 0;
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
