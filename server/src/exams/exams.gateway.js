class ExamsGateway {
  constructor() {
    this.io = null;
    this.onlineUsers = new Map();
  }

  init(io) {
    this.io = io;
    io.on('connection', (socket) => {
      console.log(`Socket Client connected: ${socket.id}`);

      socket.on('disconnect', () => {
        console.log(`Socket Client disconnected: ${socket.id}`);
        const userInfo = this.onlineUsers.get(socket.id);
        this.onlineUsers.delete(socket.id);
        if (userInfo) {
          this.io.emit('userStatusChanged', { userId: userInfo.userId, status: 'offline', role: userInfo.role });
        }
      });

      socket.on('identify', (data) => {
        const userId = typeof data === 'string' ? data : data.userId;
        const role = typeof data === 'string' ? 'student' : (data.role || 'student');
        
        console.log(`User ${userId} (${role}) identified on socket ${socket.id}`);
        this.onlineUsers.set(socket.id, { userId, role });
        this.io.emit('userStatusChanged', { userId, status: 'online', role });
      });
    });
  }

  getOnlineUserIds() {
    return Array.from(new Set(Array.from(this.onlineUsers.values()).map(u => u.userId)));
  }

  getOnlineUsersCount() {
    return this.getOnlineStudentsCount();
  }

  getOnlineStudentsCount() {
    const studentUserIds = Array.from(this.onlineUsers.values())
      .filter(u => u.role === 'student')
      .map(u => u.userId);
    return new Set(studentUserIds).size;
  }

  isUserOnline(userId) {
    return Array.from(this.onlineUsers.values()).some(u => u.userId === userId);
  }

  emitStatsUpdate(data) {
    if (this.io) this.io.emit('statsUpdated', data);
  }

  emitExamCreated(exam) {
    if (this.io) this.io.emit('examCreated', exam);
  }

  emitExamDeleted(examId) {
    if (this.io) this.io.emit('examDeleted', examId);
  }

  emitAnalyticsUpdate(collegeCode) {
    if (this.io) this.io.emit('analyticsUpdated', { collegeCode });
  }

  emitInstructorStatsUpdate(data) {
    if (this.io) this.io.emit('instructorStatsUpdated', data);
  }

  emitViolation(data) {
    if (this.io) this.io.emit('violationLogged', data);
  }

  // Emit to a specific user by userId
  emitToUser(userId, event, data) {
    if (!this.io) return;
    for (const [socketId, userInfo] of this.onlineUsers.entries()) {
      if (userInfo.userId === userId) {
        this.io.to(socketId).emit(event, data);
      }
    }
  }

  // Notify student that their progress was updated (hired/rejected/approved)
  emitProgressUpdate(userId, action) {
    console.log(`[Socket] Emitting progressUpdated to user ${userId}: ${action}`);
    this.emitToUser(userId, 'progressUpdated', { action });
  }
}

export const examsGateway = new ExamsGateway();
