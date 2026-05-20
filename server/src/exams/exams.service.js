import { Types } from 'mongoose';
import { User } from '../auth/user.schema.js';
import { Exam, PersonalExam } from './exam.schema.js';
import { ProgressService } from '../progress/progress.service.js';
import { examsGateway } from './exams.gateway.js';
import { PerformanceAnalysisService } from '../interview/performance-analysis.service.js';

export class ExamsService {
  constructor() {
    this.examsGateway = examsGateway;
    this.perfService = new PerformanceAnalysisService();
    this.progressService = new ProgressService();
  }

  toObjectId(id) {
    if (!id) return null;
    try {
      if (typeof id === 'string') return new Types.ObjectId(id);
      return id;
    } catch (e) {
      return id;
    }
  }

  async isPersonalUser(userId) {
    if (!userId) return false;
    try {
      const user = await User.findById(userId).lean().exec();
      if (!user) return false;
      if (user.role !== 'student') return false;

      const hasInstitution = user.institutionId && 
                             user.institutionId !== 'null' && 
                             user.institutionId !== 'undefined' && 
                             user.institutionId !== '';
                             
      const hasCreatedBy = user.createdBy && 
                           user.createdBy !== 'null' && 
                           user.createdBy !== 'undefined' && 
                           user.createdBy !== '';

      return !hasInstitution && !hasCreatedBy;
    } catch (error) {
      console.error('[ExamsService] Error in isPersonalUser:', error.message);
      return false;
    }
  }

  async create(examData) {
    try {
      const uId = examData.userId ? this.toObjectId(examData.userId) : null;
      const bId = examData.baseExamId ? this.toObjectId(examData.baseExamId) : null;

      const isPersonal = await this.isPersonalUser(uId);
      const ModelToUse = isPersonal ? PersonalExam : Exam;

      if (uId && bId) {
        const filter = { userId: uId, baseExamId: bId, status: { $ne: 'completed' } };
        const existing = await ModelToUse.findOne(filter).exec();
        if (existing) {
          console.log(`Idempotency: existing pending attempt found for user ${uId}, returning existing.`);
          this.examsGateway.emitExamCreated(existing);
          return existing;
        }
      }

      // Force-convert userId to ObjectId for consistent storage
      if (uId) examData.userId = uId;
      if (bId) examData.baseExamId = bId;

      console.log(`[ExamCreate] Saving exam "${examData.title}" for userId: ${examData.userId} (type: ${typeof examData.userId})`);

      const createdExam = new ModelToUse(examData);
      const savedExam = await createdExam.save();
      console.log(`[ExamCreate] Saved exam _id: ${savedExam._id}, userId: ${savedExam.userId}`);
      this.examsGateway.emitExamCreated(savedExam);
      return savedExam;


    } catch (error) {
      if (error.code === 11000) {
        const isPersonal = await this.isPersonalUser(examData.userId);
        const ModelToUse = isPersonal ? PersonalExam : Exam;
        const raceExisting = await ModelToUse.findOne({
          title: examData.title,
          topic: examData.topic,
          userId: examData.userId,
          baseExamId: examData.baseExamId
        }).exec();
        if (raceExisting) return raceExisting;
      }
      throw error;
    }
  }

  async findAll(query = {}) {
    let filter = {};
    const requestUserId = query.requestUserId;
    const role = query.role || 'student';
    const templateOnly = query.templateOnly === 'true';

    if (templateOnly) {
      filter = { $or: [{ userId: null }, { userId: { $exists: false } }] };
      return Exam.find(filter).sort({ createdAt: -1 }).exec();
    }

    if (role === 'instructor' || role === 'hod') {
      const instructorIdObj = this.toObjectId(requestUserId);
      const instId = query.institutionId;

      const exams = await Exam.find({
        $or: [
          { userId: instructorIdObj },
          ...(instId ? [{ institutionId: instId }] : []),
          { userId: null },
          { userId: { $exists: false } }
        ]
      }).sort({ createdAt: -1 }).lean().exec();

      const enrichedExams = await Promise.all(exams.map(async (t) => {
        const studentAttempts = await Exam.find({
          baseExamId: t._id,
          status: 'completed'
        }).lean().exec();

        if (studentAttempts.length > 0) {
          const totalScore = studentAttempts.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);
          return {
            ...t,
            status: 'completed',
            score: Math.round(totalScore / studentAttempts.length),
            attemptCount: studentAttempts.length
          };
        }
        return t;
      }));

      return enrichedExams;
    } else {
      // Student View
      const studentIdObj = this.toObjectId(requestUserId);
      console.log(`[ExamList] Student view for userId: ${studentIdObj}`);

      const isPersonal = await this.isPersonalUser(studentIdObj);
      const ModelToUse = isPersonal ? PersonalExam : Exam;

      // 1. Find ALL exams owned by this student
      const userExams = await ModelToUse.find({
        userId: studentIdObj,
        // STRICTOR ISOLATION: Personal students should only see their own AI assessments.
        // If an instructor exam was previously leaked/attempted, hide it from the dashboard.
        ...(isPersonal ? { baseExamId: { $exists: false } } : {})
      }).sort({ createdAt: -1 }).lean().exec();

      console.log(`[ExamList] Found ${userExams.length} exams for student ${studentIdObj}`);

      // 2. Find instructor templates (for institutional students)
      const student = await User.findById(studentIdObj).lean().exec();
      let instructorId = student?.createdBy;
      if (!instructorId && student?.institutionId) {
        const instructor = await User.findOne({ institutionId: student.institutionId, role: { $in: ['instructor', 'hod'] } });
        if (instructor) instructorId = instructor._id;
      }

      const instructorIdObj = instructorId ? this.toObjectId(instructorId) : null;

      // 2. Find ALL global templates (institutional/baseline) + instructor templates
      // PERSONAL STUDENTS: Only see their own AI-generated exams to avoid data leakage from instructors.
      let availableTemplates = [];
      if (!isPersonal) {
        availableTemplates = await Exam.find({
          $or: [
            { userId: null },
            { userId: { $exists: false } },
            ...(instructorIdObj ? [{ userId: instructorIdObj }] : [])
          ]
        }).sort({ createdAt: -1 }).lean().exec();
      }

      // 3. Exclude templates the student already attempted
      const attemptedTemplateIds = userExams.map(e => e.baseExamId?.toString()).filter(Boolean);
      const unattemptedTemplates = availableTemplates.filter(e => !attemptedTemplateIds.includes(e._id.toString()));

      const finalList = [...userExams, ...unattemptedTemplates];
      console.log(`[ExamList] Returning ${finalList.length} total exams (${userExams.length} own + ${unattemptedTemplates.length} templates)`);
      return finalList;
    }
  }

  async findOne(id) {
    let exam = await Exam.findById(id).exec();
    if (!exam) {
      exam = await PersonalExam.findById(id).exec();
    }
    if (!exam) throw new Error('Exam not found');
    return exam;
  }

  async updateResult(id, score, userId, userAnswers = {}, timeSpent = 0, status = 'completed') {
    const finalStatus = status === 'disqualified' 
      ? 'disqualified' 
      : 'completed';

    console.log(`Processing submission for exam ${id} by user ${userId} with score ${score}. Final Status: ${finalStatus}`);
    
    let exam = await Exam.findById(id).exec();
    if (!exam) exam = await PersonalExam.findById(id).exec();
    if (!exam) throw new Error('Exam not found');

    const isPersonal = await this.isPersonalUser(userId);

    // STRICTOR ISOLATION: Prevent personal students from attempting institutional templates
    if (isPersonal && !exam.isAI && !exam.userId) {
      console.warn(`[ExamsService] Blocking personal student ${userId} from attempting institutional template ${id}`);
      throw new Error('This assessment is only available for institutional students.');
    }

    const ModelToUse = isPersonal ? PersonalExam : Exam;

    if (!exam.userId || exam.userId.toString() !== userId.toString()) {
      console.log(`Creating student attempt for exam ${id} by user ${userId} (Owner: ${exam.userId})`);
      const templateId = exam._id;
      const uIdObj = this.toObjectId(userId);
      const tIdObj = this.toObjectId(templateId);

      const existingCopy = await ModelToUse.findOne({ baseExamId: tIdObj, userId: uIdObj }).exec();
      
      if (existingCopy) {
        console.log(`Updating existing copy ${existingCopy._id} instead of creating new.`);
        exam = await ModelToUse.findByIdAndUpdate(
          existingCopy._id,
          { score, userAnswers, timeSpent, status: finalStatus, completionTimestamp: new Date() },
          { returnDocument: 'after' }
        ).exec();
      } else {
        const safeFields = {
          title: exam.title,
          topic: exam.topic,
          duration: exam.duration,
          questionCount: exam.questionCount,
          aptitudeQuestionCount: exam.aptitudeQuestionCount,
          aptitudeScenario: exam.aptitudeScenario,
          questions: exam.questions,
          isAI: exam.isAI || false,
          isAptitude: exam.isAptitude || false
        };
        
        const query = { baseExamId: tIdObj, userId: uIdObj };
        
        exam = await ModelToUse.findOneAndUpdate(
          query,
          { 
            $set: {
              ...safeFields,
              score, 
              userAnswers, 
              timeSpent, 
              status: finalStatus,
              completionTimestamp: new Date(),
              baseExamId: tIdObj,
              userId: uIdObj
            } 
          },
          { 
            upsert: true, 
            returnDocument: 'after',
            setDefaultsOnInsert: true 
          }
        ).exec();
      }
    } else {
      exam = await ModelToUse.findByIdAndUpdate(
        id,
        { score, userAnswers, timeSpent, status: finalStatus, completionTimestamp: new Date() },
        { returnDocument: 'after' }
      ).exec();
    }

    try {
      const statsUserId = userId || exam?.userId?.toString();
      if (statsUserId) {
        if (exam) exam.status = finalStatus;

        if (finalStatus === 'completed') {
           const topicStr = (exam.topic || '').toLowerCase();
           const isAptitude = topicStr.includes('aptitude') || exam.isAptitude;
           
           // Sync performance data for BOTH personal and institutional students
           // so that the AI Interview Generator has context for the student's previous rounds.
           if (isAptitude) {
              await this.perfService.recordAptitudePerformance(statsUserId, { percentage: score, feedback: 'Completed Aptitude Exam' });
           } else {
              await this.perfService.recordMcqPerformance(statsUserId, { score, weakAreas: [] });
           }

           // Auto-advance progress stage for Personal Students ONLY if they passed (score >= 70)
           if (isPersonal) {
             if (score >= 70) {
               if (isAptitude) {
                  console.log(`[ExamsService] Advancing personal student ${statsUserId} from APTITUDE stage (Score: ${score})`);
                  await this.progressService.moveToNextStage(statsUserId, 'APTITUDE');
               } else {
                  console.log(`[ExamsService] Advancing personal student ${statsUserId} from MCQ stage (Score: ${score})`);
                  await this.progressService.moveToNextStage(statsUserId, 'MCQ');
               }
             } else {
               console.log(`[ExamsService] Personal student ${statsUserId} scored ${score} (< 70). Not advancing stage. Retake required.`);
             }
           }
        }
        
        const newStats = await this.getAnalytics(statsUserId);
      
        await User.findByIdAndUpdate(statsUserId, { 
          xp: newStats.totalXP, 
          level: newStats.level,
          streak: newStats.streak
        }).exec();

        this.examsGateway.emitStatsUpdate(newStats);

        const instructorStats = await this.getInstructorStats('month');
        this.examsGateway.emitInstructorStatsUpdate(instructorStats);
      }
    } catch (err) {
      console.error('Failed to sync post-submit stats:', err);
    }

    return exam;
  }

  async delete(id) {
    let deleted = await Exam.findByIdAndDelete(id).exec();
    if (!deleted) {
      deleted = await PersonalExam.findByIdAndDelete(id).exec();
    }
    if (deleted) {
      const deleteResult = await Exam.deleteMany({ baseExamId: this.toObjectId(id) }).exec();
      const deletePersonalResult = await PersonalExam.deleteMany({ baseExamId: this.toObjectId(id) }).exec();
      console.log(`Cascade deleted ${deleteResult.deletedCount + deletePersonalResult.deletedCount} associated exam attempts for ID ${id}`);
      this.examsGateway.emitExamDeleted(id);
      return deleted;
    }
    return null;
  }

  async logViolation(id, violation) {
    let updated = await Exam.findByIdAndUpdate(
      id,
      { $push: { violations: { ...violation, timestamp: new Date() } } },
      { new: true }
    ).exec();
    
    if (!updated) {
      updated = await PersonalExam.findByIdAndUpdate(
        id,
        { $push: { violations: { ...violation, timestamp: new Date() } } },
        { new: true }
      ).exec();
    }


    if (updated) {
      this.examsGateway.emitViolation({
        examId: id,
        title: updated.title,
        userId: updated.userId,
        violation
      });

      if (updated.userId) {
        this.perfService.updateViolations(updated.userId.toString(), updated.violations);
      }
    }

    return updated;
  }

  async getAnalytics(userId) {
    try {
      const query = userId ? { userId: this.toObjectId(userId) } : {};
      
      let exams = await Exam.find(query).lean().exec();
      if (userId) {
         const personalExams = await PersonalExam.find(query).lean().exec();
         exams = [...exams, ...personalExams];
      }

      if (exams.length === 0) {
        return {
          overallAccuracy: 0,
          questionsDone: 0,
          totalExams: 0,
          totalXP: 0,
          studyHours: 0,
          streak: 0,
          accuracyHistory: [],
          topicPerformance: [],
          weakAreas: []
        };
      }

      const totalScore = exams.reduce((s, e) => s + (Number(e.score) || 0), 0);
      const overallAccuracy = Math.round(totalScore / exams.length);
      const questionsDone = exams.reduce((s, e) => s + (Number(e.questionCount) || 0), 0);
      
      const totalMinutes = exams.reduce((s, e) => s + (Number(e.duration) || 0), 0);
      const studyHours = Number((totalMinutes / 60).toFixed(1));

      const topicMap = new Map();
      exams.forEach(e => {
        const topicName = e.topic || 'General';
        if (!topicMap.has(topicName)) {
          topicMap.set(topicName, { topic: topicName, totalScore: 0, count: 0, totalQuest: 0, correct: 0 });
        }
        const data = topicMap.get(topicName);
        const score = Number(e.score) || 0;
        const qCount = Number(e.questionCount) || 0;
        
        data.totalScore += score;
        data.count += 1;
        data.totalQuest += qCount;
        data.correct += Math.round((score / 100) * qCount);
      });

      const topicPerformance = Array.from(topicMap.values()).map(d => ({
        topic: d.topic,
        accuracy: Math.round(d.totalScore / d.count),
        score: Math.round(d.totalScore / d.count),
        correct: d.correct,
        wrong: Math.max(0, d.totalQuest - d.correct),
        fullMark: 100
      }));

      const accuracyHistory = exams.map((e, i) => ({
        label: `E${i + 1}`,
        accuracy: Number(e.score) || 0,
        date: e.createdAt ? new Date(e.createdAt).toISOString() : new Date().toISOString()
      }));

      const weakAreas = topicPerformance
        .filter(t => t.accuracy < 70)
        .sort((a, b) => a.accuracy - b.accuracy)
        .map(t => ({
           topic: t.topic,
           score: t.accuracy,
           tag: t.accuracy < 60 ? 'Critical Revision Required' : 'Growth Potential',
           sessions: topicMap.get(t.topic)?.count || 1
        }))
        .slice(0, 3);

      const dates = [...new Set(exams
        .filter(e => e.createdAt)
        .map(e => new Date(e.createdAt).toDateString())
      )];
      
      let streak = 0;
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const hasToday = dates.includes(today.toDateString());
      const hasYesterday = dates.includes(yesterday.toDateString());

      if (hasToday || hasYesterday) {
        let countDate = new Date(hasToday ? today : yesterday);
        streak = 1;
        countDate.setDate(countDate.getDate() - 1);
        while (dates.includes(countDate.toDateString())) {
          streak++;
          countDate.setDate(countDate.getDate() - 1);
        }
      }

      const totalXP = exams.reduce((s, e) => s + 100 + (Math.round(((Number(e.score) || 0) / 100) * (Number(e.questionCount) || 0)) * 10), 0);
      const level = Math.floor(totalXP / 300) + 1;

      return {
        overallAccuracy,
        questionsDone,
        totalExams: exams.length,
        totalXP,
        level,
        studyHours,
        streak,
        accuracyHistory,
        topicPerformance,
        weakAreas
      };
    } catch (error) {
      console.error('BACKEND ANALYTICS CRASH:', error);
      return {
        overallAccuracy: 0,
        questionsDone: 0,
        studyHours: 0,
        streak: 0,
        totalXP: 0,
        level: 1,
        accuracyHistory: [],
        topicPerformance: [],
        weakAreas: [],
        isError: true
      };
    }
  }

  async getInstructorStats(filter = 'month', instructorId) {
    const instructor = await User.findById(instructorId).lean().exec();
    const instId = instructor?.institutionId;
    const now = new Date();
    let startDate = new Date();
    
    if (filter === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (filter === 'week') {
      startDate.setDate(now.getDate() - 7);
    } else {
      startDate.setMonth(now.getMonth() - 1);
    }

    const userQuery = { 
      role: { $nin: ['instructor', 'hod'] },
      $or: [
        { createdBy: instructorId },
        ...(instId ? [{ institutionId: instId }] : [])
      ]
    };

    const students = await User.find(userQuery).lean().exec();
    const studentIds = students.map(u => u._id.toString());
    const totalStudents = students.length;
    
    const allExams = await Exam.find({ 
      status: 'completed',
      updatedAt: { $gte: startDate },
      userId: { $in: studentIds.map(id => this.toObjectId(id)) }
    }).lean().exec();

    const completedExams = await Exam.find({ 
      status: 'completed',
      userId: { $in: studentIds.map(id => this.toObjectId(id)) }
    }).lean().exec();
    const activeStudents = this.examsGateway.getOnlineUsersCount();
    
    const avgScore = allExams.length > 0 
      ? Math.round(allExams.reduce((s, e) => s + (Number(e.score) || 0), 0) / allExams.length)
      : 0;

    const recentActivity = allExams.slice(0, 10).map(e => ({
      type: 'completion',
      title: e.title,
      date: e.updatedAt || e.createdAt,
      score: e.score
    }));

    const cohortPerformance = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthLabel = d.toLocaleString('en-US', { month: 'short' });
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

      const monthExams = completedExams.filter(e => {
        const date = new Date(e.updatedAt || e.createdAt);
        return date >= monthStart && date <= monthEnd;
      });

      const monthAvg = monthExams.length > 0
        ? Math.round(monthExams.reduce((s, e) => s + (Number(e.score) || 0), 0) / monthExams.length)
        : 0;
      cohortPerformance.push({ name: monthLabel, score: monthAvg });
    }

    const topTopicStats = await this.getInstructorDeepAnalytics();
    const insights = {
      engagement: topTopicStats.engagementScore,
      priority: topTopicStats.topicMastery.length > 0 ? topTopicStats.topicMastery[0].name : 'General Concepts',
      status: avgScore > 80 ? 'Exceptional' : avgScore > 60 ? 'Stable' : 'Action Required'
    };

    return {
      totalStudents,
      activeStudents,
      examsCreated: (await Exam.countDocuments({ 
        $and: [
          { $or: [{ baseExamId: null }, { baseExamId: { $exists: false } }] },
          { 
            $or: [
              { userId: this.toObjectId(instructorId) },
              ...(instId ? [{ institutionId: instId }] : [])
            ]
          }
        ]
      }).exec()),
      avgClassScore: avgScore,
      recentActivity,
      cohortPerformance,
      insights
    };
  }

  async getInstructorStudents(instructorId) {
    const instructor = await User.findById(instructorId).lean().exec();
    const instId = instructor?.institutionId;

    const userQuery = { 
      role: { $nin: ['instructor', 'hod'] },
      $or: [
        { createdBy: instructorId },
        ...(instId ? [{ institutionId: instId }] : [])
      ]
    };

    const users = await User.find(userQuery).lean().exec();
    const studentIds = users.map(u => u._id.toString());

    const allExams = await Exam.find({
      $or: [
        { userId: { $in: studentIds.map(id => this.toObjectId(id)) } },
        { userId: this.toObjectId(instructorId) },
        { userId: null }
      ]
    }).lean().exec();
    
    const baseExams = allExams.filter(e => !e.baseExamId && (e.userId?.toString() === instructorId || !e.userId));
    const totalPotentialExams = baseExams.length;

    const studentStats = users.map((u) => {
      let name = u.username;
      if (!name) {
        const nameMatch = u.email?.match(/^([^@]*)@/);
        name = nameMatch ? nameMatch[1] : 'Learner';
        name = name.charAt(0).toUpperCase() + name.slice(1).replace(/[0-9._]/g, ' ');
      }

      const studentExams = allExams.filter(e => e.userId?.toString() === u._id?.toString() && e.status === 'completed');
      
      const performance = studentExams.length > 0 
        ? Math.round(studentExams.reduce((s, e) => s + (Number(e.score) || 0), 0) / studentExams.length)
        : 0;

      const progress = totalPotentialExams > 0 ? Math.min(100, Math.round((studentExams.length / totalPotentialExams) * 100)) : 0;
      const active = studentExams.length > 0;

      return {
        id: u._id?.toString(),
        name,
        email: u.email,
        performance,
        progress,
        active,
        joinDate: u.createdAt || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      };
    });

    const totalPerf = studentStats.reduce((s, e) => s + e.performance, 0);
    const avgPerformance = studentStats.length > 0 ? Math.round(totalPerf / studentStats.length) : 0;
    const completionRate = studentStats.length > 0 ? Math.round((studentStats.filter(s => s.active).length / studentStats.length) * 100) : 0;
    const churnRisk = studentStats.filter(s => !s.active).length;

    return {
      students: studentStats,
      metrics: {
        completionRate,
        avgPerformance,
        churnRisk
      }
    };
  }

  async getInstructorDeepAnalytics(instructorId) {
    try {
      const instructor = await User.findById(instructorId).lean().exec();
      const instId = instructor?.institutionId;

      const userQuery = { 
        role: { $nin: ['instructor', 'hod'] },
        $or: [
          { createdBy: instructorId },
          ...(instId ? [{ institutionId: instId }] : [])
        ]
      };

      const students = await User.find(userQuery).lean().exec();
      const studentIds = students.map(u => u._id.toString());

      const exams = await Exam.find({
        $or: [
          { userId: { $in: studentIds.map(id => this.toObjectId(id)) } },
          { userId: this.toObjectId(instructorId) },
          { userId: null }
        ]
      }).lean().exec();
      
      const completedExams = exams.filter(e => e.status === 'completed' && studentIds.includes(e.userId?.toString()));

      const topicMap = new Map();
      completedExams.forEach(e => {
        const topic = e.topic || 'General';
        if (!topicMap.has(topic)) topicMap.set(topic, { total: 0, count: 0 });
        const stats = topicMap.get(topic);
        stats.total += (Number(e.score) || 0);
        stats.count++;
      });

      const colors = ['#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#8B5CF6'];
      const topicMastery = Array.from(topicMap.entries())
        .map(([name, stat], index) => ({
          name: name.length > 15 ? name.substring(0, 15) + '...' : name,
          value: Math.round(stat.total / stat.count),
          color: colors[index % colors.length]
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 7);

      const engagementData = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        const dayStart = new Date(d.setHours(0,0,0,0));
        const dayEnd = new Date(d.setHours(23,59,59,999));
        
        const dayExams = exams.filter(e => {
          if (!e.createdAt) return false;
          const createDate = new Date(e.createdAt);
          return createDate >= dayStart && createDate <= dayEnd;
        });
        const dayCompletedExams = completedExams.filter(e => {
          const dateSource = e.updatedAt || e.createdAt;
          if (!dateSource) return false;
          const updDate = new Date(dateSource);
          return updDate >= dayStart && updDate <= dayEnd;
        });

        const dayUsers = new Set();
        dayExams.forEach(e => { if (e.userId) dayUsers.add(e.userId.toString()); });
        dayCompletedExams.forEach(e => { if (e.userId) dayUsers.add(e.userId.toString()); });

        let activeCount = dayUsers.size;
        if (i === 0) {
          activeCount = Math.max(activeCount, this.examsGateway.getOnlineUsersCount());
        }

        engagementData.push({
          name: dayName,
          active: activeCount,
          exams: dayExams.length
        });
      }

      const totalTimeScored = completedExams.reduce((s, e) => s + (Number(e.duration) || 0) * 0.7, 0); 
      const avgSeconds = completedExams.length > 0 ? (totalTimeScored / completedExams.length) * 60 : 0;
      const avgTimeStr = `${Math.floor(avgSeconds / 60)}m ${Math.floor(avgSeconds % 60)}s`;

      const passCount = completedExams.filter(e => (Number(e.score) || 0) >= 70).length;
      const passRate = completedExams.length > 0 ? Math.round((passCount / completedExams.length) * 100) : 0;
      const engagementScore = Math.min(10, Math.round((completedExams.length / Math.max(1, exams.length)) * 10));

      return {
        topicMastery: topicMastery.length > 0 ? topicMastery : [
          { name: 'General', value: 0, color: '#7C3AED' }
        ],
        engagementData,
        avgTime: avgTimeStr,
        passRate: `${passRate}%`,
        engagementScore: `${engagementScore}/10`
      };
    } catch (error) {
      console.error('[DeepAnalytics Error]:', error);
      return {
        topicMastery: [{ name: 'N/A', value: 0, color: '#94A3B8' }],
        engagementData: [],
        avgTime: '0m 0s',
        passRate: '0%',
        engagementScore: '0/10'
      };
    }
  }

  async resetUserExams(userId) {
    try {
      const userIdObj = this.toObjectId(userId);
      const updateObj = { 
        $set: {
          status: 'pending', 
          score: 0, 
          userAnswers: {}, 
          timeSpent: 0 
        } 
      };
      console.log(`[ExamsService] Resetting exams for user: ${userId}`);
      await Exam.updateMany({ userId: userIdObj }, updateObj);
      await PersonalExam.updateMany({ userId: userIdObj }, updateObj);
      
      // Recalculate and sync User.xp after reset
      const newStats = await this.getAnalytics(userId);
      await User.findByIdAndUpdate(userIdObj, { 
        xp: newStats.totalXP, 
        level: newStats.level,
        streak: newStats.streak
      }).exec();
      
      return { success: true };
    } catch (error) {
      console.error('[ExamsService] Reset Error:', error);
      throw error;
    }
  }
}
