import express from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { terminalSessions, projects } from '../db/schema.js';
import { createId } from '@paralleldrive/cuid2';

const router = express.Router();

// Create a new terminal session
router.post('/', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { projectId, workingDirectory, environment } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify project belongs to user if projectId is provided
    if (projectId) {
      const project = await db.select()
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
        .limit(1);

      if (project.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
    }

    const sessionId = createId();
    await db.insert(terminalSessions).values({
      userId,
      projectId: projectId || null,
      sessionId,
      status: 'active',
      workingDirectory: workingDirectory || `/workspace/${projectId || 'default'}`,
      environment: environment || {},
      lastAccessedAt: new Date(),
    });

    // Fetch the created session
    const session = await db.select()
      .from(terminalSessions)
      .where(eq(terminalSessions.sessionId, sessionId))
      .limit(1);

    res.json({ session: session[0] });
  } catch (error) {
    console.error('Error creating terminal session:', error);
    res.status(500).json({ error: 'Failed to create terminal session' });
  }
});

// Get user's terminal sessions
router.get('/', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { projectId, status } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const conditions = [eq(terminalSessions.userId, userId)];
    
    if (projectId) {
      conditions.push(eq(terminalSessions.projectId, projectId as string));
    }

    if (status) {
      conditions.push(eq(terminalSessions.status, status as string));
    }

    const sessions = await db.select()
      .from(terminalSessions)
      .where(and(...conditions))
      .orderBy(terminalSessions.lastAccessedAt);
    res.json({ sessions });
  } catch (error) {
    console.error('Error fetching terminal sessions:', error);
    res.status(500).json({ error: 'Failed to fetch terminal sessions' });
  }
});

// Get specific terminal session
router.get('/:sessionId', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { sessionId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const session = await db.select()
      .from(terminalSessions)
      .where(and(
        eq(terminalSessions.sessionId, sessionId),
        eq(terminalSessions.userId, userId)
      ))
      .limit(1);

    if (session.length === 0) {
      return res.status(404).json({ error: 'Terminal session not found' });
    }

    // Update last accessed time
    await db.update(terminalSessions)
      .set({ lastAccessedAt: new Date() })
      .where(eq(terminalSessions.sessionId, sessionId));

    res.json({ session: session[0] });
  } catch (error) {
    console.error('Error fetching terminal session:', error);
    res.status(500).json({ error: 'Failed to fetch terminal session' });
  }
});

// Update terminal session status
router.patch('/:sessionId', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { sessionId } = req.params;
    const { status, workingDirectory, environment } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const updateData: any = { updatedAt: new Date() };
    
    if (status) updateData.status = status;
    if (workingDirectory) updateData.workingDirectory = workingDirectory;
    if (environment) updateData.environment = environment;

    await db.update(terminalSessions)
      .set(updateData)
      .where(and(
        eq(terminalSessions.sessionId, sessionId),
        eq(terminalSessions.userId, userId)
      ));

    // Fetch the updated session
    const session = await db.select()
      .from(terminalSessions)
      .where(and(
        eq(terminalSessions.sessionId, sessionId),
        eq(terminalSessions.userId, userId)
      ))
      .limit(1);

    if (session.length === 0) {
      return res.status(404).json({ error: 'Terminal session not found' });
    }

    res.json({ session: session[0] });
  } catch (error) {
    console.error('Error updating terminal session:', error);
    res.status(500).json({ error: 'Failed to update terminal session' });
  }
});

// Delete terminal session
router.delete('/:sessionId', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { sessionId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if session exists first
    const existingSession = await db.select()
      .from(terminalSessions)
      .where(and(
        eq(terminalSessions.sessionId, sessionId),
        eq(terminalSessions.userId, userId)
      ))
      .limit(1);

    if (existingSession.length === 0) {
      return res.status(404).json({ error: 'Terminal session not found' });
    }

    await db.delete(terminalSessions)
      .where(and(
        eq(terminalSessions.sessionId, sessionId),
        eq(terminalSessions.userId, userId)
      ));

    res.json({ message: 'Terminal session deleted successfully' });
  } catch (error) {
    console.error('Error deleting terminal session:', error);
    res.status(500).json({ error: 'Failed to delete terminal session' });
  }
});

export default router;