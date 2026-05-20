import express from 'express';
import multer from 'multer';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { User } from '../auth/user.schema.js';
import { Progress } from '../progress/progress.schema.js';
import bcrypt from 'bcryptjs';
import csv from 'csv-parser';
import { Readable } from 'stream';

const router = express.Router();
const upload = multer();

router.post('/upload-csv', requireAuth, upload.single('file'), async (req, res) => {
  const userRole = req.user.role || (req.user.email?.includes('hod') ? 'hod' : (req.user.email?.includes('instructor') ? 'instructor' : 'student'));
  
  if (userRole !== 'instructor' && userRole !== 'hod') {
    return res.status(400).json({ message: 'Only instructors can upload institutional users. Your role: ' + userRole });
  }

  const results = [];
  const stream = Readable.from(req.file.buffer);
  
  stream
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        if (results.length === 0) {
          return res.json({ success: false, message: 'CSV file is empty or invalid format.' });
        }

        const { defaultPassword } = req.body;
        console.log(`[InstitutionRoute] Processing ${results.length} users with defaultPassword: ${defaultPassword ? 'YES' : 'NO'}`);

        let successCount = 0;
        for (const row of results) {
          const instId = row.institutionId || row.InstitutionID || row.INSTITUTION_ID || row.id;
          const email = row.rollNo || row.RollNo || row.rollno || row.email || row.Email || row.EMAIL;
          const password = defaultPassword || row.password || row.Password || row.PASSWORD;
          
          if (!instId || !email || !password) {
             console.log('Skipping invalid row (missing ID/Email/Pass):', row);
             continue; 
          }
          
          const normalizedEmail = email.toLowerCase().trim();
          
          const existingUser = await User.findOne({ email: normalizedEmail });
          if (existingUser) continue;

          const username = row.username || row.Username || row.USERNAME || row.name || row.Name || row.NAME || row['Student Name'] || row['StudentName'] || row.studentName || row['Full Name'] || row.FullName || normalizedEmail.split('@')[0];
          const hashedPassword = await bcrypt.hash(password.toString(), 10);
          
          const newUser = await User.create({
            username,
            email: normalizedEmail,
            password: hashedPassword,
            displayPassword: password.toString(), // Save for reference
            role: 'student',
            institutionId: instId || req.user.institutionId,
            institutionName: (req.user.username || 'Institution') + ' Admin Group',
            createdBy: req.user.userId
          });

          try {
            await Progress.create({
              user: newUser._id,
              currentStage: 'RESUME_UPLOAD',  // Institutional users skip MCQ
              status: 'ACTIVE',
              points: 0,
              context: {},
              reports: {}
            });
          } catch (progressErr) {
            console.error(`Failed to init progress for ${normalizedEmail}:`, progressErr);
          }

          successCount++;
        }

        res.json({ success: true, count: successCount, message: `${successCount} users imported successfully.` });
      } catch (err) {
        console.error('Error during CSV bulk insert:', err);
        res.status(400).json({ message: 'Database sync failed: ' + err.message });
      }
    });
});

router.get('/users', requireAuth, async (req, res) => {
  try {
    const query = req.user.institutionId 
      ? { institutionId: req.user.institutionId, role: 'student' } 
      : { createdBy: req.user.userId };
    const users = await User.find(query).select('-password');
    res.json(users);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

router.delete('/users', requireAuth, async (req, res) => {
  try {
    const query = req.user.institutionId 
      ? { institutionId: req.user.institutionId, role: 'student' } 
      : { createdBy: req.user.userId };
    await User.deleteMany(query);
    res.json({ success: true, message: 'Institutional users deleted.' });
  } catch (error) { res.status(400).json({ message: error.message }); }
});

export default router;
