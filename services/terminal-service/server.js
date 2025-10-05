const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const pty = require('node-pty');
const { exec } = require('child_process');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const simpleGit = require('simple-git');

const SAFE_GIT_REF_REGEX = /^[A-Za-z0-9._/-]{1,255}$/;

const sanitizeWorkspaceSegment = (input = '', fallback = 'project') => {
  const normalized = input
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
};

const isSafeGitRef = (value = '') => {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > 255) return false;
  if (!SAFE_GIT_REF_REGEX.test(value)) return false;
  if (value.includes('..') || value.includes('~') || value.includes('^')) return false;
  if (value.includes(':') || value.includes('?') || value.includes('*') || value.includes('[') || value.includes('\\')) return false;
  if (value.includes('//') || value.includes('@{')) return false;
  if (value.startsWith('/') || value.endsWith('/') || value.endsWith('.lock')) return false;
  return true;
};

const writeInfoToTerminal = (sessionInfo, message) => {
  if (!sessionInfo?.ptyProcess || sessionInfo.ptyProcess.killed) {
    return;
  }

  const safeMessage = `# ${String(message || '')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 500)}`;

  sessionInfo.ptyProcess.write(`${safeMessage}\r`);
};

const DATABASE_SERVICE_URL = process.env.DATABASE_SERVICE_URL || 'http://database-service:3003';

const normalizeRepoUrl = (url = '') =>
  url
    .replace(/^https?:\/\/(?:.*@)?github.com\//i, '')
    .replace(/^git@github.com:/i, '')
    .replace(/\.git$/i, '')
    .trim()
    .toLowerCase();

const buildAuthenticatedRepoUrl = (repoUrl, token) => {
  if (!token || !repoUrl.startsWith('http')) {
    return repoUrl;
  }

  try {
    const url = new URL(repoUrl);
    url.username = token;
    return url.toString();
  } catch (error) {
    return repoUrl.replace('https://github.com/', `https://${encodeURIComponent(token)}@github.com/`);
  }
};

async function getGithubCredentials(userId) {
  try {
    const response = await fetch(`${DATABASE_SERVICE_URL}/settings/providers`, {
      headers: {
        'x-user-id': userId,
      },
    });

    if (!response.ok) {
      throw new Error(`Provider settings request failed with status ${response.status}`);
    }

    const data = await response.json();
    const github = data?.github || {};

    return {
      token: github.apiKey || null,
      installationId: github.installation_id || null,
      appType: github.app_type || null,
    };
  } catch (error) {
    console.error('Error retrieving GitHub credentials:', error.message || error);
    return {
      token: null,
      installationId: null,
      appType: null,
    };
  }
}

// Persistent workspace state storage
const WORKSPACE_STATE_FILE = '/workspaces/.workspace_state.json';

// Load workspace state from persistent storage
function loadWorkspaceState() {
  try {
    if (fs.existsSync(WORKSPACE_STATE_FILE)) {
      const data = fs.readFileSync(WORKSPACE_STATE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading workspace state:', error);
  }
  return {};
}

// Save workspace state to persistent storage
function saveWorkspaceState(state) {
  try {
    fs.writeFileSync(WORKSPACE_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Error saving workspace state:', error);
  }
}

// Get user's persistent workspace state
function getUserWorkspaceState(userId) {
  const state = loadWorkspaceState();
  return state[userId] || {};
}

// Update user's workspace state
function updateUserWorkspaceState(userId, updates) {
  const state = loadWorkspaceState();
  state[userId] = { ...state[userId], ...updates };
  saveWorkspaceState(state);
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:8000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["*"]
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

const userSessions = new Map(); // userId -> { username, workingDir, sessionId, homeDir, ptyProcess }

app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:8000", "http://127.0.0.1:3000"],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// Increase server timeout
server.setTimeout(120000); // 2 minute timeout

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'terminal-service', timestamp: new Date().toISOString() });
});

// Socket.IO endpoint test
app.get('/socket.io-test', (req, res) => {
  res.json({ 
    status: 'Socket.IO server running', 
    connectedClients: io.engine.clientsCount,
    transports: ['websocket', 'polling']
  });
});

// REST API endpoints for terminal session management
app.post('/terminal/create-session', async (req, res) => {
  try {
    const { userId, projectId, userEmail, workspacePath } = req.body;
    console.log(`REST: Creating terminal session for user: ${userId}`);
    if (workspacePath) {
      console.log(`Using workspace path: ${workspacePath}`);
    }
    
    // Check if session already exists and is valid
    const existingSession = userSessions.get(userId);
    if (existingSession && existingSession.ptyProcess && !existingSession.ptyProcess.killed) {
      console.log(`REST: Reusing existing terminal session for user: ${userId}`);
      return res.json({
        success: true,
        id: existingSession.sessionId,
        userId: userId,
        projectId: projectId,
        sessionId: existingSession.sessionId,
        status: 'active',
        workingDirectory: existingSession.workingDir,
        environment: {},
        createdAt: existingSession.createdAt,
        updatedAt: existingSession.createdAt,
        lastAccessedAt: new Date().toISOString()
      });
    }
    
    const sessionInfo = await terminalManager.createUserSession(userId, projectId, userEmail, workspacePath);
    
    res.json({
      success: true,
      id: sessionInfo.sessionId,
      userId: userId,
      projectId: projectId,
      sessionId: sessionInfo.sessionId,
      status: 'active',
      workingDirectory: sessionInfo.workingDir,
      environment: {},
      createdAt: sessionInfo.createdAt,
      updatedAt: sessionInfo.createdAt,
      lastAccessedAt: sessionInfo.createdAt
    });
  } catch (error) {
    console.error('REST: Error creating terminal session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/terminal/session/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`REST: Deleting terminal session for user: ${userId}`);
    
    const success = await terminalManager.deleteUserSession(userId);
    
    res.json({
      success
    });
  } catch (error) {
    console.error('REST: Error deleting terminal session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/terminal/session/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const sessionInfo = userSessions.get(userId);
    
    if (!sessionInfo) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    res.json({
      success: true,
      id: sessionInfo.sessionId,
      userId: userId,
      sessionId: sessionInfo.sessionId,
      status: 'active',
      workingDirectory: sessionInfo.workingDir,
      environment: {},
      createdAt: sessionInfo.createdAt,
      updatedAt: sessionInfo.createdAt,
      lastAccessedAt: sessionInfo.createdAt
    });
  } catch (error) {
    console.error('REST: Error getting terminal session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Git operations integrated with terminal workspace
app.post('/git/clone', async (req, res) => {
  try {
    const { repoUrl, branch, userId, projectName, userEmail } = req.body;
    
    if (!userId || !repoUrl || !branch) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId, repoUrl, and branch are required' 
      });
    }

    if (!isSafeGitRef(branch)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid branch name provided'
      });
    }

    // Get username from session if exists, otherwise derive from email or userId
    let username;
    const sessionInfo = userSessions.get(userId);
    if (sessionInfo) {
      username = sessionInfo.username;
    } else if (userEmail) {
      username = userEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    } else {
      username = `user${userId.slice(-8)}`;
    }

    const repoIdentifier = normalizeRepoUrl(repoUrl);
    const projectSlugSource = projectName || repoIdentifier.split('/').pop() || 'project';
    const projectSlug = sanitizeWorkspaceSegment(projectSlugSource);
    
    // Use username-based workspace
    const userWorkspace = `/workspaces/${username}`;
    const projectPath = path.join(userWorkspace, projectSlug);
    const resolvedWorkspace = path.resolve(userWorkspace);
    const resolvedProjectPath = path.resolve(projectPath);

    if (!resolvedProjectPath.startsWith(`${resolvedWorkspace}${path.sep}`) && resolvedProjectPath !== resolvedWorkspace) {
      throw new Error('Invalid project path resolved');
    }

    const { token: githubToken } = await getGithubCredentials(userId);
    const authRepoUrl = repoUrl.includes('github.com') && githubToken
      ? buildAuthenticatedRepoUrl(repoUrl, githubToken)
      : repoUrl;

    // Ensure the user workspace directory exists
    if (!fs.existsSync(userWorkspace)) {
      await fsPromises.mkdir(userWorkspace, { recursive: true });
      console.log(`Created user workspace: ${userWorkspace}`);
    }

    const repoAlreadyExists = fs.existsSync(projectPath);
    const repoAlreadyInitialized = fs.existsSync(path.join(projectPath, '.git'));

    // Initialize git in user workspace root for potential clone
    const git = simpleGit(userWorkspace);

    const cloneRepository = async (targetBranch) => {
      await git.clone(authRepoUrl, projectPath, ['--depth', '1', '--single-branch', '--branch', targetBranch]);
      const projectGit = simpleGit(projectPath);
      await projectGit.checkout(targetBranch);
      if (githubToken && repoUrl.startsWith('http')) {
        await projectGit.remote(['set-url', 'origin', repoUrl]);
      }
    };

    if (repoAlreadyExists && repoAlreadyInitialized) {
      const projectGit = simpleGit(projectPath);
      let normalizedOrigin = '';
      try {
        const remotes = await projectGit.getRemotes(true);
        const origin = remotes.find((remote) => remote.name === 'origin');
        normalizedOrigin = normalizeRepoUrl(origin?.refs.fetch || origin?.refs.push || '');
      } catch (remoteError) {
        console.warn('Unable to read existing git remotes, re-cloning repository:', remoteError.message || remoteError);
      }

      if (!normalizedOrigin || normalizedOrigin !== repoIdentifier) {
        await fsPromises.rm(projectPath, { recursive: true, force: true });
        await cloneRepository(branch);
      } else {
        try {
          await projectGit.fetch();
          await projectGit.checkout(branch);
          await projectGit.pull('origin', branch, { '--ff-only': null });
        } catch (syncError) {
          console.warn('Failed to update existing repository cleanly, re-cloning:', syncError.message || syncError);
          await fsPromises.rm(projectPath, { recursive: true, force: true });
          await cloneRepository(branch);
        }
      }
    } else {
      if (repoAlreadyExists) {
        await fsPromises.rm(projectPath, { recursive: true, force: true });
      }
      await cloneRepository(branch);
    }

    // Update session to point to the project directory (if session exists)
    if (sessionInfo) {
      sessionInfo.workingDir = projectPath;
      
      // Change terminal to project directory
      sessionInfo.ptyProcess.write(`cd ${projectPath}\r`);
      sessionInfo.ptyProcess.write(`clear\r`);
      writeInfoToTerminal(sessionInfo, `Repository ready: ${projectSlug} (${branch})`);
      sessionInfo.ptyProcess.write('git status\r');
    }

    // Update persistent workspace state
    updateUserWorkspaceState(userId, {
      currentProject: projectSlug,
      workspacePath: projectPath,
      repoUrl,
      currentBranch: branch,
      lastUpdated: new Date().toISOString()
    });

    console.log(`✅ Repository cloned to: ${projectPath} for user: ${username}`);

    res.json({
      success: true,
      message: 'Repository ready in workspace',
      workspacePath: projectPath,
      branch
    });

  } catch (error) {
    console.error('❌ Git clone error:', error);
    
    // Check for specific error types
    let errorMessage = error.message;
    if (error.message.includes('File name too long')) {
      errorMessage = 'Repository contains files with names that are too long. This is usually caused by malformed GitHub Actions workflow files. Please fix the repository on GitHub.';
    } else if (error.message.includes('pathspec') && error.message.includes('did not match')) {
      errorMessage = 'The specified branch does not exist in the repository.';
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.message
    });
  }
});
app.post('/git/checkout', async (req, res) => {
  try {
    const { branch, userId, create } = req.body;
    if (!userId || !branch) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId and branch are required' 
      });
    }

    if (!isSafeGitRef(branch)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid branch name provided'
      });
    }

    const sessionInfo = userSessions.get(userId);
    if (!sessionInfo) {
      return res.status(404).json({ 
        success: false, 
        error: 'Terminal session not found for user' 
      });
    }

    const git = simpleGit(sessionInfo.workingDir);
    
    if (create) {
      // Create and checkout new branch
      await git.checkoutLocalBranch(branch);
      writeInfoToTerminal(sessionInfo, `Created and checked out ${branch}`);
    } else {
      // Checkout existing branch
      await git.checkout(branch);
      writeInfoToTerminal(sessionInfo, `Checked out ${branch}`);
    }
    
    // Update persistent workspace state with new branch
    updateUserWorkspaceState(userId, {
      currentBranch: branch,
      lastUpdated: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: `Switched to branch: ${branch}`,
      branch: branch
    });

  } catch (error) {
    console.error('Git checkout error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/git/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const sessionInfo = userSessions.get(userId);
    if (!sessionInfo) {
      return res.status(404).json({ 
        success: false, 
        error: 'Terminal session not found for user' 
      });
    }

    const git = simpleGit(sessionInfo.workingDir);
    const status = await git.status();
    
    res.json({
      success: true,
      status: status
    });

  } catch (error) {
    console.error('Git status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/git/commit', async (req, res) => {
  try {
    const { userId, message, files } = req.body;
    
    if (!userId || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId and message are required' 
      });
    }

    const sessionInfo = userSessions.get(userId);
    if (!sessionInfo) {
      return res.status(404).json({ 
        success: false, 
        error: 'Terminal session not found for user' 
      });
    }

    const git = simpleGit(sessionInfo.workingDir);
    
    // Add files or all changes
    if (files && files.length > 0) {
      await git.add(files);
    } else {
      await git.add('.');
    }
    
    // Commit changes
    const result = await git.commit(message);
    
    writeInfoToTerminal(sessionInfo, `Committed changes: ${result.commit}`);
    
    res.json({
      success: true,
      message: 'Changes committed successfully',
      commit: result.commit
    });

  } catch (error) {
    console.error('Git commit error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/git/push', async (req, res) => {
  try {
    const { userId, branch } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId is required' 
      });
    }

    const sessionInfo = userSessions.get(userId);
    if (!sessionInfo) {
      return res.status(404).json({ 
        success: false, 
        error: 'Terminal session not found for user' 
      });
    }

    const git = simpleGit(sessionInfo.workingDir);
    
    // Push to remote
    const result = await git.push('origin', branch || 'HEAD');
    
    writeInfoToTerminal(sessionInfo, `Pushed changes to ${branch || 'HEAD'}`);
    
    res.json({
      success: true,
      message: 'Changes pushed successfully',
      result: result
    });

  } catch (error) {
    console.error('Git push error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user's workspace state
app.get('/workspace/state/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const userState = getUserWorkspaceState(userId);
    
    res.json({
      success: true,
      state: userState
    });
  } catch (error) {
    console.error('Error getting workspace state:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// List files in workspace
app.get('/workspace/files/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const sessionInfo = userSessions.get(userId);
    
    if (!sessionInfo) {
      return res.status(404).json({
        success: false,
        error: 'Terminal session not found'
      });
    }

    const workspacePath = sessionInfo.workingDir;
    const username = sessionInfo.username;
    
    // Security check: ensure workspace path is within user's home directory
    const userHome = `/workspaces/${username}`;
    if (!workspacePath.startsWith(userHome)) {
      console.error(`Security violation: User ${username} attempted to access ${workspacePath}`);
      return res.status(403).json({
        success: false,
        error: 'Access denied: Cannot access files outside your workspace'
      });
    }
    
    if (!fs.existsSync(workspacePath)) {
      return res.json({
        success: true,
        files: []
      });
    }

    const collectedFiles = [];

    const traverseWorkspace = (dirPath, relativePath = '') => {
      let entries = [];
      try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true });
      } catch (err) {
        console.error(`Error reading directory ${dirPath}:`, err);
        return;
      }

      console.log(`📂 Reading directory: ${dirPath}, found ${entries.length} entries`);

      for (const entry of entries) {
        // Skip noisy/system directories
        if (entry.name === 'node_modules' || entry.name === '.DS_Store') {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);
        const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          collectedFiles.push({
            id: `folder-${relPath}`,
            name: entry.name,
            path: relPath,
            type: 'folder'
          });
          traverseWorkspace(fullPath, relPath);
        } else {
          const fileItem = {
            id: `file-${relPath}`,
            name: entry.name,
            path: relPath,
            type: 'file'
          };

          try {
            const stats = fs.statSync(fullPath);
            if (stats.size < 1024 * 1024) {
              fileItem.content = fs.readFileSync(fullPath, 'utf8');
            }
          } catch (err) {
            console.warn(`Could not read file content for ${fullPath}:`, err.message);
          }

          collectedFiles.push(fileItem);
        }
      }
    };

    traverseWorkspace(workspacePath);
    console.log(`✅ Collected ${collectedFiles.length} workspace entries`);

    res.json({
      success: true,
      files: collectedFiles
    });
  } catch (error) {
    console.error('Error listing workspace files:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Read file content from workspace
app.get('/workspace/file/:userId/*', async (req, res) => {
  try {
    const { userId } = req.params;
    const filePath = req.params[0]; // Everything after /workspace/file/:userId/
    
    const sessionInfo = userSessions.get(userId);
    if (!sessionInfo) {
      return res.status(404).json({
        success: false,
        error: 'Terminal session not found'
      });
    }

    const fullPath = path.join(sessionInfo.workingDir, filePath);
    const username = sessionInfo.username;
    const userHome = `/workspaces/${username}`;
    
    // Security check: ensure the path is within user's home directory
    if (!fullPath.startsWith(userHome)) {
      console.error(`Security violation: User ${username} attempted to access ${fullPath}`);
      return res.status(403).json({
        success: false,
        error: 'Access denied: Cannot access files outside your workspace'
      });
    }
    
    // Additional security check: ensure no path traversal
    const resolvedPath = path.resolve(fullPath);
    if (!resolvedPath.startsWith(userHome)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Invalid file path'
      });
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    const content = await fsPromises.readFile(fullPath, 'utf8');

    res.json({
      success: true,
      content
    });
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update user's workspace state
app.post('/workspace/state/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    
    updateUserWorkspaceState(userId, updates);
    
    res.json({
      success: true,
      message: 'Workspace state updated successfully'
    });
  } catch (error) {
    console.error('Error updating workspace state:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Direct PTY terminal session management
class TerminalManager {
  async createUserSession(userId, projectId = null, userEmail = null, workspacePath = null) {
    try {
      const username = userEmail ? userEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') : `user${userId.slice(-4)}`;
      const sessionId = uuidv4();

      const workspaceRoot = `/workspaces/${username}`;
      const userState = getUserWorkspaceState(userId);

      let workingDir = workspaceRoot;
      if (workspacePath) {
        const resolvedRequestedPath = path.resolve(workspacePath);
        if (!resolvedRequestedPath.startsWith(`${workspaceRoot}`)) {
          throw new Error('Requested workspace path is outside of user workspace');
        }
        workingDir = resolvedRequestedPath;
      } else if (userState.workspacePath && fs.existsSync(userState.workspacePath)) {
        const resolvedStatePath = path.resolve(userState.workspacePath);
        if (resolvedStatePath.startsWith(`${workspaceRoot}`)) {
          workingDir = resolvedStatePath;
          console.log(`Restoring previous workspace: ${workingDir}`);
        }
      }

      const homeDir = workspaceRoot;

      console.log(`Creating PTY terminal session for user: ${username}`);
      console.log(`Home directory: ${homeDir}`);
      console.log(`Initial working directory: ${workingDir}`);
      
      // Create user account if it doesn't exist
      await this.createSystemUser(username, homeDir, workingDir);

      await this.ensureDirectory(homeDir);
      if (workingDir !== homeDir) {
        await this.ensureDirectory(workingDir);
      }

      try {
        await this.executeCommand(`chown -R ${username}:${username} ${homeDir}`);
        if (workingDir !== homeDir) {
          await this.executeCommand(`chown -R ${username}:${username} ${workingDir}`);
        }
        await this.executeCommand(`chmod 700 ${homeDir}`);
      } catch (error) {
        console.log('Permission setting failed, continuing...');
      }
      
      // Create a restricted shell wrapper script that sources bashrc
      const restrictedShellPath = path.join('/tmp', `restricted_shell_${username}.sh`);
      const bashrcPath = path.join(workingDir, '.bashrc');
      
      // Create .bashrc with cd override and useful aliases
  const bashrcContent = `# Restricted bashrc for workspace isolation
export WORKSPACE_ROOT="${workspaceRoot}"
export HOME="${homeDir}"
export USER="${username}"
export PS1="${username}@workspace:\\w$ "

# Helper function to check if a path is within workspace
function _check_path_access() {
  local target_path="\$1"
  local resolved_path
  
  # Handle relative paths
  if [[ "\$target_path" != /* ]]; then
    target_path="\$(pwd)/\$target_path"
  fi
  
  # Normalize path
  if command -v realpath &> /dev/null; then
    resolved_path="\$(realpath -m "\$target_path" 2>/dev/null || echo "\$target_path")"
  else
    resolved_path="\$(readlink -f "\$target_path" 2>/dev/null || echo "\$target_path")"
  fi
  
  # Check if within workspace
  if [[ "\$resolved_path" != "\$WORKSPACE_ROOT"* ]]; then
    echo "⛔ Access denied: Cannot access files outside workspace" >&2
    echo "   Workspace: \$WORKSPACE_ROOT" >&2
    echo "   Attempted: \$resolved_path" >&2
    return 1
  fi
  
  return 0
}

# Override cd command to prevent leaving workspace
function cd() {
  local target="\${1:-.}"
  local new_dir
  
  # Handle no arguments (cd to home)
  if [ $# -eq 0 ]; then
    new_dir="$WORKSPACE_ROOT"
  # Absolute path
  elif [[ "\$target" = /* ]]; then
    new_dir="\$target"
  # Relative path
  else
    new_dir="\$(pwd)/\$target"
  fi
  
  # Normalize path
  if command -v realpath &> /dev/null; then
    new_dir="\$(realpath -m "\$new_dir" 2>/dev/null || echo "\$new_dir")"
  else
    new_dir="\$(readlink -f "\$new_dir" 2>/dev/null || echo "\$new_dir")"
  fi
  
  # Check if the new directory is within workspace
  if [[ "\$new_dir" != "\$WORKSPACE_ROOT"* ]]; then
    echo "⛔ Access denied: Cannot navigate outside workspace"
    echo "   Workspace: \$WORKSPACE_ROOT"
    echo "   Attempted: \$new_dir"
    return 1
  fi
  
  # Check if directory exists
  if [ ! -d "\$new_dir" ]; then
    echo "bash: cd: \$target: No such file or directory"
    return 1
  fi
  
  # Perform the cd
  builtin cd "\$new_dir"
}

# Override file access commands to prevent reading files outside workspace
function cat() {
  local file
  for file in "\$@"; do
    # Skip flags
    [[ "\$file" == -* ]] && continue
    _check_path_access "\$file" || return 1
  done
  command cat "\$@"
}

function ls() {
  local arg
  local has_path=0
  for arg in "\$@"; do
    # Skip flags
    [[ "\$arg" == -* ]] && continue
    has_path=1
    _check_path_access "\$arg" || return 1
  done
  # If no path specified, ls current directory (which is safe)
  command ls "\$@"
}

function vim() { _check_path_access "\$1" && command vim "\$@"; }
function nano() { _check_path_access "\$1" && command nano "\$@"; }
function less() { _check_path_access "\$1" && command less "\$@"; }
function more() { _check_path_access "\$1" && command more "\$@"; }
function head() { _check_path_access "\$1" && command head "\$@"; }
function tail() { _check_path_access "\$1" && command tail "\$@"; }
function grep() {
  # For grep, check all non-flag arguments
  local arg
  for arg in "\$@"; do
    [[ "\$arg" == -* ]] && continue
    [ -e "\$arg" ] && { _check_path_access "\$arg" || return 1; }
  done
  command grep "\$@"
}

# Disable pushd/popd/dirs to prevent bypassing cd
function pushd() { echo "⛔ pushd is disabled"; return 1; }
function popd() { echo "⛔ popd is disabled"; return 1; }
function dirs() { echo "⛔ dirs is disabled"; return 1; }

# Safe aliases (no .. alias that could bypass cd)
alias ls='ls --color=auto'
alias ll='ls -lah'
alias la='ls -A'
alias l='ls -CF'

# Enable bash completion if available
if [ -f /etc/bash_completion ] && ! shopt -oq posix; then
  . /etc/bash_completion
fi

# Git aliases
alias gs='git status'
alias ga='git add'
alias gc='git commit'
alias gp='git push'
alias gl='git log --oneline'
`;

      // Write .bashrc
      await fsPromises.writeFile(bashrcPath, bashrcContent, { mode: 0o644 });
      
      const restrictedShellScript = `#!/bin/bash
# Restricted shell wrapper that enforces workspace isolation

# Start bash with our custom bashrc
exec /bin/bash --rcfile "${bashrcPath}" -i
`;

      // Write the restricted shell script
      await fsPromises.writeFile(restrictedShellPath, restrictedShellScript, { mode: 0o755 });

      // Create PTY process with restricted shell
      const ptyProcess = pty.spawn(restrictedShellPath, [], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: workingDir,
        env: {
          TERM: 'xterm-256color',
          LANG: 'en_US.UTF-8',
          LC_ALL: 'en_US.UTF-8',
          HOME: homeDir,
          USER: username,
          WORKSPACE_ROOT: workspaceRoot,
          PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
          PS1: username + '@workspace:\\w$ ',
          DEBIAN_FRONTEND: 'noninteractive',
          BASH_SILENCE_DEPRECATION_WARNING: '1',
          // Enable proper terminal handling
          INPUTRC: '/etc/inputrc'
        }
      });
      
      // Initialize terminal with clean environment and restore git state
      setTimeout(async () => {
        // Set environment silently 
        ptyProcess.write('clear\r'); // Send clear command instead of form feed
        
        // Restore git branch state if workspace is a git repository
        if (userState.workspacePath && userState.currentBranch && fs.existsSync(workingDir)) {
          try {
            const git = simpleGit(workingDir);
            const isRepo = await git.checkIsRepo();
            
            if (isRepo) {
              const currentBranch = await git.branch();
              // Only checkout if we're not already on the correct branch
              if (currentBranch.current !== userState.currentBranch) {
                try {
                  await git.checkout(userState.currentBranch);
                  console.log(`Restored git branch: ${userState.currentBranch}`);
                  writeInfoToTerminal({ ptyProcess }, `Restored to branch: ${userState.currentBranch}`);
                } catch (branchError) {
                  console.log(`Could not restore branch ${userState.currentBranch}:`, branchError.message);
                }
              } else {
                console.log(`Already on correct branch: ${userState.currentBranch}`);
              }
            }
          } catch (gitError) {
            console.log('Git state restoration failed:', gitError.message);
          }
        }
      }, 2000); // Increased timeout to allow git operations
      
      const sessionInfo = {
        username,
        workingDir,
        sessionId,
        homeDir,
        ptyProcess,
        createdAt: new Date().toISOString()
      };
      
      userSessions.set(userId, sessionInfo);
      
      console.log(`PTY terminal session created for ${username}`);
      return sessionInfo;
      
    } catch (error) {
      console.error('Error creating user session:', error);
      throw error;
    }
  }

  async createSystemUser(username, homeDir, workingDir = '/workspaces') {
    try {
      // Check if user already exists
      const userExists = await new Promise((resolve) => {
        exec(`id ${username}`, (error) => {
          resolve(!error);
        });
      });

      if (!userExists) {
        console.log(`Creating system user: ${username} with home: ${homeDir}`);
        
        // Create the home directory first with proper permissions
        await this.ensureDirectory(homeDir);
        
        // Create user with home directory and bash shell (no create home since it exists)
        await this.executeCommand(`useradd --no-create-home -d ${homeDir} -s /bin/bash ${username}`);
        await this.executeCommand(`echo "${username}:password" | chpasswd`);
        
        // Add user to sudo group for admin access
        await this.executeCommand(`usermod -aG sudo ${username}`);
        
        // Set ownership and restrictive permissions on home directory
        await this.executeCommand(`chown -R ${username}:${username} ${homeDir}`);
        await this.executeCommand(`chmod 700 ${homeDir}`);
        
        // Set up shell environment with proper PATH and bash completion
        const bashrc = `# Enable bash completion silently
if [ -f /etc/bash_completion ]; then
    . /etc/bash_completion 2>/dev/null
fi

if [ -f /usr/share/bash-completion/bash_completion ]; then
    . /usr/share/bash-completion/bash_completion 2>/dev/null
fi

# Enable programmable completion features silently
if [ -f /etc/bash_completion ] && ! shopt -oq posix; then
    . /etc/bash_completion 2>/dev/null
fi

# Enable readline settings for better completion (silently)
bind "set completion-ignore-case on" 2>/dev/null
bind "set show-all-if-ambiguous on" 2>/dev/null
bind "set visible-stats on" 2>/dev/null
bind "set mark-symlinked-directories on" 2>/dev/null
bind "set colored-stats on" 2>/dev/null

# Configure key bindings for cross-platform compatibility
bind "\\177" backward-delete-char 2>/dev/null  # DEL character (backspace)
bind "\\e[3~" delete-char 2>/dev/null          # Forward delete

# Workspace restriction - prevent leaving workspace
export WORKSPACE_ROOT='${homeDir}'

# Override cd to prevent directory traversal outside workspace
cd() {
  local target="\${1:-.}"
  local new_dir
  
  # Resolve the target directory
  if [[ "\$target" = /* ]]; then
    new_dir="\$target"
  else
    new_dir="\$(pwd)/\$target"
  fi
  
  # Normalize path
  new_dir="\$(readlink -f "\$new_dir" 2>/dev/null || realpath "\$new_dir" 2>/dev/null || echo "\$new_dir")"
  
  # Check if trying to go outside workspace
  if [[ "\$new_dir" != "\$WORKSPACE_ROOT"* ]] && [[ "\$new_dir" != "\$WORKSPACE_ROOT" ]]; then
    echo "⛔ Access denied: Cannot navigate outside workspace (\$WORKSPACE_ROOT)"
    return 1
  fi
  
  # Perform the cd
  builtin cd "\$new_dir" || return 1
}

# Set up environment with simple prompt
export PS1='${username}@workspace:\\w$ '
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export HOME=${homeDir}
export TERM=xterm
export LANG=C
export LC_ALL=C
export DEBIAN_FRONTEND=noninteractive
export BASH_SILENCE_DEPRECATION_WARNING=1

# Enable command history
export HISTSIZE=1000
export HISTFILESIZE=2000
shopt -s histappend

# Enable bash completion options
shopt -s cdspell
shopt -s checkwinsize
shopt -s cmdhist
shopt -s dotglob
shopt -s expand_aliases
shopt -s extglob
shopt -s histappend
shopt -s hostcomplete

# Enable color support and useful aliases
alias ls='ls --color=auto'
alias ll='ls -alF --color=auto'
alias la='ls -A --color=auto'
alias l='ls -CF --color=auto'
alias grep='grep --color=auto'
alias ..='cd ..'
alias ...='cd ../..'

# Make directory listing easier
alias dir='ls -la'
alias cls='clear'

# Change to working directory by default
cd ${workingDir}
`;
        
        await fs.promises.writeFile(path.join(homeDir, '.bashrc'), bashrc);
        await this.executeCommand(`chown -R ${username}:${username} ${homeDir}`);
        await this.executeCommand(`chmod 755 ${homeDir}`);
        
        console.log(`User ${username} created successfully`);
      } else {
        console.log(`User ${username} already exists`);
      }
    } catch (error) {
      console.error(`Error creating user ${username}:`, error);
      // Don't throw - continue anyway
    }
  }

  async ensureDirectory(dir) {
    try {
      await fs.promises.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Command failed: ${command}`, error);
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  async deleteUserSession(userId) {
    const sessionInfo = userSessions.get(userId);
    if (sessionInfo) {
      try {
        console.log(`Deleting PTY session and user: ${sessionInfo.username}`);
        
        // Kill the PTY process
        if (sessionInfo.ptyProcess && !sessionInfo.ptyProcess.killed) {
          sessionInfo.ptyProcess.kill();
          console.log(`PTY process killed for ${sessionInfo.username}`);
        }
        
        // Kill any processes running as this user
        try {
          await this.executeCommand(`pkill -u ${sessionInfo.username}`);
        } catch (error) {
          console.log('No processes to kill for user');
        }
        
        // Delete the user from the system
        try {
          await this.executeCommand(`userdel -r ${sessionInfo.username}`);
          console.log(`System user ${sessionInfo.username} deleted`);
        } catch (error) {
          console.log('Failed to delete system user, continuing...');
        }
        
        userSessions.delete(userId);
        console.log(`Session deleted for user ${userId}`);
        return true;
      } catch (error) {
        console.error('Error deleting session:', error);
        return false;
      }
    }
    return false;
  }

  writeToTerminal(userId, data) {
    const sessionInfo = userSessions.get(userId);
    if (!sessionInfo || !sessionInfo.ptyProcess) {
      throw new Error('No PTY session found for user');
    }

    sessionInfo.ptyProcess.write(data);
  }

  resizeTerminal(userId, cols, rows) {
    const sessionInfo = userSessions.get(userId);
    if (!sessionInfo || !sessionInfo.ptyProcess) {
      throw new Error('No PTY session found for user');
    }

    sessionInfo.ptyProcess.resize(cols, rows);
  }

  getPtyProcess(userId) {
    const sessionInfo = userSessions.get(userId);
    return sessionInfo ? sessionInfo.ptyProcess : null;
  }
}

const terminalManager = new TerminalManager();

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  console.log('🔧 Socket auth:', socket.handshake.auth);
  console.log('🌐 Socket query:', socket.handshake.query);
  console.log('📍 Client address:', socket.handshake.address);

  socket.on('create-terminal', async (data) => {
    try {
      console.log('📥 Received create-terminal request:', JSON.stringify(data));
      const { userId, projectId, userEmail, workspacePath } = data;
      console.log(`🚀 Creating PTY terminal for user: ${userId}`);
      if (workspacePath) {
        console.log(`📂 Using workspace path: ${workspacePath}`);
      }

      const sessionInfo = await terminalManager.createUserSession(userId, projectId, userEmail, workspacePath);
      
      // Set up PTY data streaming
      const ptyProcess = sessionInfo.ptyProcess;
      
      ptyProcess.onData((data) => {
        console.log('PTY Output:', JSON.stringify(data));
        socket.emit('terminal-output', { data });
      });
      
      ptyProcess.onExit((exitCode, signal) => {
        console.log(`PTY process exited with code ${exitCode}, signal ${signal}`);
        socket.emit('terminal-exit', { exitCode, signal });
      });
      
      console.log('✅ Terminal session created successfully');
      socket.emit('terminal-created', {
        success: true,
        sessionId: sessionInfo.sessionId,
        username: sessionInfo.username,
        workingDir: sessionInfo.workingDir
      });
      console.log('📤 Sent terminal-created event to client');

    } catch (error) {
      console.error('❌ Error creating terminal:', error);
      socket.emit('terminal-error', {
        error: error.message
      });
    }
  });

  socket.on('terminal-input', async (data) => {
    try {
      const { userId, sessionId, input, data: inputData } = data;
      const terminalInput = input || inputData; // Support both property names
      console.log('Terminal Input received:', JSON.stringify(terminalInput), 'from userId:', userId, 'sessionId:', sessionId);
      terminalManager.writeToTerminal(userId, terminalInput);
    } catch (error) {
      console.error('Error writing to terminal:', error);
      socket.emit('terminal-error', {
        error: error.message
      });
    }
  });

  socket.on('terminal-resize', async (data) => {
    try {
      const { userId, cols, rows } = data;
      terminalManager.resizeTerminal(userId, cols, rows);
    } catch (error) {
      console.error('Error resizing terminal:', error);
    }
  });

  socket.on('delete-terminal', async (data) => {
    try {
      const { userId } = data;
      const success = await terminalManager.deleteUserSession(userId);
      
      socket.emit('terminal-deleted', {
        success
      });

    } catch (error) {
      console.error('Error deleting terminal:', error);
      socket.emit('terminal-error', {
        error: error.message
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    activeSessions: userSessions.size,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3004;
server.listen(PORT, () => {
  console.log(`Terminal service running on port ${PORT}`);
});