import { Progress } from '../progress/progress.schema.js';
import { User } from '../auth/user.schema.js';

export const requireStage = (requiredStage) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      let progress = await Progress.findOne({ user: req.user.userId });
      
      if (!progress) {
        // Check if institutional user — create progress at RESUME_UPLOAD
        const user = await User.findById(req.user.userId).lean();
        if (user?.institutionId) {
          progress = await Progress.create({
            user: req.user.userId,
            currentStage: 'RESUME_UPLOAD',
            status: 'ACTIVE',
            points: 0,
            context: {},
            reports: {}
          });
        } else {
          return res.status(403).json({ message: 'No progress found for user' });
        }
      }

      // Auto-promote institutional users stuck at MCQ
      if (progress.currentStage === 'MCQ' && requiredStage !== 'MCQ') {
        const user = await User.findById(req.user.userId).lean();
        if (user?.institutionId) {
          progress.currentStage = 'RESUME_UPLOAD';
          progress.lastActivity = new Date();
          await progress.save();
          console.log(`[ProgressGuard] Auto-promoted institutional user ${req.user.userId} from MCQ to RESUME_UPLOAD`);
        }
      }

      if (progress.currentStage !== requiredStage) {
        return res.status(403).json({ 
          message: `Stage locked. You are currently at ${progress.currentStage}, but this requires ${requiredStage}.` 
        });
      }

      next();
    } catch (error) {
      console.error('[ProgressGuard Error]', error);
      res.status(500).json({ message: 'Internal server error validating progress stage' });
    }
  };
};
