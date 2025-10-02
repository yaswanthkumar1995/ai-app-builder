const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const pty = require('node-pty');
const { exec } = require('child_process');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

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
app.use(express.json());

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
    const { userId, projectId, userEmail } = req.body;
    console.log(`REST: Creating terminal session for user: ${userId}`);
    
    const sessionInfo = await terminalManager.createUserSession(userId, projectId, userEmail);
    
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

// Direct PTY terminal session management
class TerminalManager {
  async createUserSession(userId, projectId = null, userEmail = null) {
    try {
      const username = userEmail ? userEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') : `user${userId.slice(-4)}`;
      const sessionId = uuidv4();
      const workingDir = projectId ? `/workspaces/${projectId}` : `/workspaces/default`;
      const homeDir = `/tmp/users/${username}`;
      
      console.log(`Creating PTY terminal session for user: ${username}`);
      
      // Create user account if it doesn't exist
      await this.createSystemUser(username, homeDir, workingDir);
      
      // Create working directory
      await this.ensureDirectory(workingDir);
      await this.ensureDirectory(homeDir);
      
      // Set permissions
      try {
        await this.executeCommand(`chown ${username}:${username} ${homeDir}`);
        await this.executeCommand(`chown ${username}:${username} ${workingDir}`);
      } catch (error) {
        console.log('Permission setting failed, continuing...');
      }
      
      // Create PTY process with login shell for the user (enables bash completion)
      const ptyProcess = pty.spawn('su', ['-l', username], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: workingDir,
        env: {
          TERM: 'xterm-256color',
          LANG: 'en_US.UTF-8',
          LC_ALL: 'en_US.UTF-8',
          COLORTERM: 'truecolor'
        }
      });
      
      // Send initial commands to set up the environment properly
      setTimeout(() => {
        ptyProcess.write('export PS1="\\[\\033[01;32m\\]' + username + '@terminal\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]$ "\r');
        ptyProcess.write('clear\r');
      }, 1000);
      
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
        
        // Create user with home directory and bash shell
        await this.executeCommand(`useradd -m -d ${homeDir} -s /bin/bash ${username}`);
        await this.executeCommand(`echo "${username}:password" | chpasswd`);
        
        // Add user to sudo group for admin access
        await this.executeCommand(`usermod -aG sudo ${username}`);
        
        // Set up shell environment with proper PATH and bash completion
        const bashrc = `# Enable bash completion - multiple sources
if [ -f /etc/bash_completion ]; then
    . /etc/bash_completion
fi

if [ -f /usr/share/bash-completion/bash_completion ]; then
    . /usr/share/bash-completion/bash_completion
fi

# Enable programmable completion features
if [ -f /etc/bash_completion ] && ! shopt -oq posix; then
    . /etc/bash_completion
fi

# Set up environment with colorful prompt
export PS1='\\[\\033[01;32m\\]${username}@terminal\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]$ '
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export HOME=${homeDir}
export TERM=xterm-256color
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

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
  console.log('Client connected:', socket.id);

  socket.on('create-terminal', async (data) => {
    try {
      const { userId, projectId, userEmail } = data;
      console.log(`Creating PTY terminal for user: ${userId}`);

      const sessionInfo = await terminalManager.createUserSession(userId, projectId, userEmail);
      
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
      
      socket.emit('terminal-created', {
        success: true,
        sessionId: sessionInfo.sessionId,
        username: sessionInfo.username,
        workingDir: sessionInfo.workingDir
      });

    } catch (error) {
      console.error('Error creating terminal:', error);
      socket.emit('terminal-error', {
        error: error.message
      });
    }
  });

  socket.on('terminal-input', async (data) => {
    try {
      const { userId, input } = data;
      console.log('Terminal Input:', JSON.stringify(input));
      terminalManager.writeToTerminal(userId, input);
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