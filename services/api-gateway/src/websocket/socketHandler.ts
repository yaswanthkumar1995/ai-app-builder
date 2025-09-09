import { Server as SocketServer, Socket } from 'socket.io';
import { logger } from '../utils/logger';

export const setupWebSocket = (io: SocketServer) => {
  io.on('connection', (socket: Socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Join user-specific room for targeted messages
    socket.on('join-user-room', (userId: string) => {
      socket.join(`user-${userId}`);
      logger.debug(`User ${userId} joined room user-${userId}`);
    });

    // Join project-specific room
    socket.on('join-project-room', (projectId: string) => {
      socket.join(`project-${projectId}`);
      logger.debug(`Client joined project room: ${projectId}`);
    });

    // Handle chat messages
    socket.on('chat-message', (data: any) => {
      logger.debug('Chat message received:', data);
      // Forward to AI service or broadcast to room
      socket.to(`user-${data.userId}`).emit('chat-response', {
        message: 'Processing your request...',
        type: 'processing'
      });
    });

    // Handle file operations
    socket.on('file-operation', (data: any) => {
      logger.debug('File operation:', data);
      // Broadcast file changes to project room
      socket.to(`project-${data.projectId}`).emit('file-updated', data);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });

    // Error handling
    socket.on('error', (error: any) => {
      logger.error('Socket error:', error);
    });
  });

  // Middleware for authentication
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    // TODO: Verify JWT token
    next();
  });

  logger.info('WebSocket server initialized');
};
