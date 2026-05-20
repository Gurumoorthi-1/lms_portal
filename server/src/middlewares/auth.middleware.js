import jwt from 'jsonwebtoken';

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded; // { email, sub (userId), role, institutionId, currentStage }
    req.user.userId = decoded.sub; // Map for legacy compatibility
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized: Token expired or invalid' });
  }
};

export const requireInstructor = (req, res, next) => {
  if (!req.user || (req.user.role !== 'instructor' && req.user.role !== 'hod')) {
    return res.status(403).json({ message: 'Forbidden: Instructor access only' });
  }
  next();
};

export const requireInstitution = (req, res, next) => {
  if (!req.user || !req.user.institutionId) {
    return res.status(403).json({ message: 'Forbidden: Institutional access only' });
  }
  next();
};
