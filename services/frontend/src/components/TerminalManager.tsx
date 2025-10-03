import React, { useState, useEffect, useRef } from 'react';
import { config } from '../config';
import { useAuthStore } from '../stores/authStore';
import { useProjectStore } from '../stores/projectStore';
import { 
  CommandLineIcon, 
  PlayIcon, 
  StopIcon, 
  XMarkIcon,
  PlusIcon,
  DocumentIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface TerminalSession {
  id: string;
  userId: string;
  projectId?: string;
  sessionId: string;
  status: 'active' | 'inactive' | 'terminated';
  workingDirectory: string;
  environment: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
}

const TerminalManager: React.FC = () => {
  const { token } = useAuthStore();
  const { currentProject } = useProjectStore();
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSession, setActiveSession] = useState<TerminalSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [output, setOutput] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTerminalSessions();
  }, [currentProject]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  const loadTerminalSessions = async () => {
    setLoading(true);
    try {
      const url = currentProject 
        ? `${config.apiGatewayUrl}/api/terminal-sessions?projectId=${currentProject.id}`
        : `${config.apiGatewayUrl}/api/terminal-sessions`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load terminal sessions');
      }

      const data = await response.json();
      setSessions(data.sessions || []);
      
      // Auto-select first active session
      const activeSession = data.sessions?.find((s: TerminalSession) => s.status === 'active');
      if (activeSession && !activeSession) {
        setActiveSession(activeSession);
      }
    } catch (error) {
      console.error('Error loading terminal sessions:', error);
      toast.error('Failed to load terminal sessions');
    } finally {
      setLoading(false);
    }
  };

  const createTerminalSession = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${config.apiGatewayUrl}/api/terminal-sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: currentProject?.id,
          workspacePath: currentProject?.workspacePath,
          workingDirectory: currentProject?.workspacePath || 
            (currentProject?.isGithubProject 
              ? `/workspaces/${currentProject.id}` 
              : `/workspace/${currentProject?.id || 'default'}`),
          environment: {
            NODE_ENV: 'development',
            PROJECT_NAME: currentProject?.name || 'default',
            ...(currentProject?.githubRepo && { GITHUB_REPO: currentProject.githubRepo }),
            ...(currentProject?.githubBranch && { GITHUB_BRANCH: currentProject.githubBranch }),
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create terminal session');
      }

      const data = await response.json();
      const newSession = data.session;
      
      setSessions(prev => [...prev, newSession]);
      setActiveSession(newSession);
      setOutput([`Terminal session created: ${newSession.sessionId}`]);
      
      toast.success('Terminal session created successfully!');
    } catch (error) {
      console.error('Error creating terminal session:', error);
      toast.error('Failed to create terminal session');
    } finally {
      setLoading(false);
    }
  };

  const terminateSession = async (sessionId: string) => {
    try {
      await fetch(`${config.apiGatewayUrl}/api/terminal-sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'terminated' }),
      });

      setSessions(prev => prev.map(s => 
        s.sessionId === sessionId 
          ? { ...s, status: 'terminated' as const }
          : s
      ));

      if (activeSession?.sessionId === sessionId) {
        setActiveSession(null);
        setOutput([]);
      }

      toast.success('Terminal session terminated');
    } catch (error) {
      console.error('Error terminating session:', error);
      toast.error('Failed to terminate session');
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await fetch(`${config.apiGatewayUrl}/api/terminal-sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
      
      if (activeSession?.sessionId === sessionId) {
        setActiveSession(null);
        setOutput([]);
      }

      toast.success('Terminal session deleted');
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Failed to delete session');
    }
  };

  const executeCommand = async (command: string) => {
    if (!activeSession) {
      toast.error('No active terminal session');
      return;
    }

    // Add command to history
    setCommandHistory(prev => [...prev, command]);
    setOutput(prev => [...prev, `$ ${command}`]);

    // Simulate command execution (in a real implementation, this would connect to the terminal service)
    try {
      // For demo purposes, simulate some common commands
      let result = '';
      
      switch (command.trim()) {
        case 'ls':
        case 'ls -la':
          result = currentProject?.files.map(f => f.name).join('\n') || 'No files';
          break;
        case 'pwd':
          result = activeSession.workingDirectory;
          break;
        case 'whoami':
          result = 'developer';
          break;
        case 'node --version':
          result = 'v18.17.0';
          break;
        case 'npm --version':
          result = '9.6.7';
          break;
        case 'git status':
          result = currentProject?.isGithubProject 
            ? 'On branch main\nnothing to commit, working tree clean'
            : 'fatal: not a git repository';
          break;
        default:
          if (command.startsWith('cd ')) {
            result = `Changed directory to ${command.substring(3)}`;
          } else if (command.startsWith('echo ')) {
            result = command.substring(5);
          } else {
            result = `Command '${command}' not found or not implemented in demo mode`;
          }
      }

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setOutput(prev => [...prev, result]);
    } catch (error) {
      setOutput(prev => [...prev, `Error: ${error}`]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (currentCommand.trim()) {
        executeCommand(currentCommand.trim());
        setCurrentCommand('');
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="h-full flex">
      {/* Sessions Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Terminal Sessions</h2>
            <button
              onClick={createTerminalSession}
              disabled={loading}
              className="p-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
          
          {currentProject && (
            <div className="text-sm text-gray-400">
              Project: <span className="text-white">{currentProject.name}</span>
              {currentProject.isGithubProject && (
                <div className="text-xs text-blue-400 mt-1">
                  GitHub: {currentProject.githubRepo?.split('/').slice(-2).join('/')}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-400">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="p-4 text-center text-gray-400">
              <CommandLineIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No terminal sessions</p>
              <p className="text-xs mt-1">Create one to get started</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`p-3 rounded-md border cursor-pointer transition-colors ${
                    activeSession?.id === session.id
                      ? 'bg-blue-900/50 border-blue-500'
                      : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                  }`}
                  onClick={() => setActiveSession(session)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white">
                      Session {session.sessionId.slice(-8)}
                    </span>
                    <div className="flex items-center space-x-1">
                      <span className={`w-2 h-2 rounded-full ${
                        session.status === 'active' ? 'bg-green-500' :
                        session.status === 'inactive' ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (session.status === 'active') {
                            terminateSession(session.sessionId);
                          } else {
                            deleteSession(session.sessionId);
                          }
                        }}
                        className="p-1 text-gray-400 hover:text-red-400"
                      >
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    <div>Status: {session.status}</div>
                    <div>Created: {formatDate(session.createdAt)}</div>
                    <div className="truncate">Dir: {session.workingDirectory}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Terminal Area */}
      <div className="flex-1 flex flex-col">
        {activeSession ? (
          <>
            {/* Terminal Header */}
            <div className="p-4 bg-gray-800 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-white">
                    Terminal - {activeSession.sessionId.slice(-8)}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {activeSession.workingDirectory}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs rounded ${
                    activeSession.status === 'active' ? 'bg-green-600 text-white' :
                    activeSession.status === 'inactive' ? 'bg-yellow-600 text-white' : 
                    'bg-red-600 text-white'
                  }`}>
                    {activeSession.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Terminal Output */}
            <div 
              ref={terminalRef}
              className="flex-1 p-4 bg-black text-green-400 font-mono text-sm overflow-y-auto"
            >
              {output.map((line, index) => (
                <div key={index} className="whitespace-pre-wrap">
                  {line}
                </div>
              ))}
            </div>

            {/* Terminal Input */}
            <div className="p-4 bg-gray-800 border-t border-gray-700">
              <div className="flex items-center">
                <span className="text-green-400 font-mono mr-2">$</span>
                <input
                  type="text"
                  value={currentCommand}
                  onChange={(e) => setCurrentCommand(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1 bg-transparent text-green-400 font-mono focus:outline-none"
                  placeholder="Enter command..."
                  disabled={activeSession.status !== 'active'}
                />
              </div>
              {activeSession.status !== 'active' && (
                <p className="text-xs text-red-400 mt-1">
                  Terminal session is {activeSession.status}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <CommandLineIcon className="h-24 w-24 mx-auto mb-4 text-gray-600" />
              <h3 className="text-xl font-semibold text-white mb-2">No Terminal Session Selected</h3>
              <p className="text-gray-400 mb-6">
                Select an existing session or create a new one to start using the terminal
              </p>
              <button
                onClick={createTerminalSession}
                disabled={loading}
                className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
              >
                <PlusIcon className="h-5 w-5 mr-2 inline" />
                Create Terminal Session
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TerminalManager;