import React, { useState, useEffect, useRef } from 'react';
import { config } from '../config';
import { useAuthStore } from '../stores/authStore';
import { useProjectStore } from '../stores/projectStore';
import toast from 'react-hot-toast';
import io from 'socket.io-client';

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

const EmbeddedTerminal: React.FC = () => {
  const { token, user } = useAuthStore();
  const { currentProject } = useProjectStore();
  const [activeSession, setActiveSession] = useState<TerminalSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string>('');
  const [containerId, setContainerId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    initializeTerminal();
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [currentProject]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  const initializeTerminal = async () => {
    if (!user) return;

    console.log('Initializing terminal for user:', user.id);
    setLoading(true);
    setConnecting(true);
    
    // Connect directly to WebSocket - no REST API needed
    connectToSocket();
  };

  const connectToSocket = () => {
    console.log('Connecting to terminal WebSocket...');
    const socket = io(`http://localhost:3004`, {
      auth: {
        token,
        userId: user?.id
      }
    });

    socket.on('connect', () => {
      console.log('Terminal WebSocket connected');
      setConnecting(false);
      setLoading(false);
      
      // Create the actual terminal session via WebSocket
      socket.emit('create-terminal', {
        userId: user?.id,
        projectId: currentProject?.id,
        userEmail: user?.email
      });
    });

    socket.on('terminal-created', (data: any) => {
      console.log('Terminal session created via WebSocket:', data);
      setActiveSession({
        id: data.sessionId,
        userId: user?.id || '',
        sessionId: data.sessionId,
        status: 'active',
        workingDirectory: data.workingDir || '/workspaces',
        environment: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString()
      });
      setOutput('Terminal ready. Type commands below.\n$ ');
    });

    socket.on('terminal-output', (data: any) => {
      try {
        // Clean ANSI escape sequences for display
        const cleanOutput = data.data ? data.data.replace(/\x1b\[[0-9;]*m/g, '') : '';
        setOutput(prev => prev + cleanOutput);
      } catch (error) {
        console.error('Error processing terminal output:', error);
      }
    });

    socket.on('terminal-error', (data: any) => {
      console.error('Terminal error:', data);
      toast.error('Terminal error: ' + (data.error || 'Unknown error'));
      setLoading(false);
      setConnecting(false);
    });

    socket.on('disconnect', () => {
      console.log('Terminal disconnected');
      setConnecting(true);
    });

    socket.on('connect_error', (error: any) => {
      console.error('Connection error:', error);
      toast.error('Terminal connection failed: ' + error.message);
      setConnecting(false);
      setLoading(false);
    });

    socketRef.current = socket;
  };

  const handleInput = (input: string) => {
    if (socketRef.current && user) {
      socketRef.current.emit('terminal-input', {
        userId: user.id,
        input: input
      });
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!activeSession || !socketRef.current) return;

    event.preventDefault();
    
    const key = event.key;
    let input = '';

    // Handle special keys
    if (key === 'Enter') {
      input = '\r';
    } else if (key === 'Backspace') {
      input = '\b';
    } else if (key === 'Tab') {
      input = '\t';
    } else if (key === 'ArrowUp') {
      input = '\x1b[A';
    } else if (key === 'ArrowDown') {
      input = '\x1b[B';
    } else if (key === 'ArrowLeft') {
      input = '\x1b[D';
    } else if (key === 'ArrowRight') {
      input = '\x1b[C';
    } else if (key === 'Escape') {
      input = '\x1b';
    } else if (event.ctrlKey) {
      // Handle Ctrl+C, Ctrl+D, etc.
      if (key === 'c') {
        input = '\x03';
      } else if (key === 'd') {
        input = '\x04';
      } else if (key === 'l') {
        input = '\x0c';
      } else if (key === 'z') {
        input = '\x1a';
      }
    } else if (key.length === 1) {
      input = key;
    }

    if (input) {
      handleInput(input);
    }
  };

  const handlePaste = async (event: React.ClipboardEvent) => {
    event.preventDefault();
    const pastedText = event.clipboardData.getData('text');
    if (pastedText && socketRef.current) {
      handleInput(pastedText);
    }
  };

  const handleCopy = () => {
    if (window.getSelection) {
      const selection = window.getSelection();
      if (selection && selection.toString()) {
        navigator.clipboard.writeText(selection.toString());
        toast.success('Copied to clipboard');
      }
    }
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    // Add context menu logic here if needed
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p>Initializing terminal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-black text-green-400 font-mono text-sm overflow-hidden flex flex-col">
      {connecting && (
        <div className="bg-yellow-600 text-black px-2 py-1 text-xs">
          Connecting to terminal...
        </div>
      )}
      
      <div 
        ref={terminalRef}
        className="flex-1 p-4 overflow-auto cursor-text"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onContextMenu={handleContextMenu}
        style={{
          outline: 'none',
          userSelect: 'text',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all'
        }}
      >
        <pre className="m-0 p-0 font-inherit leading-normal">
          {output}
        </pre>
      </div>

      <div className="bg-gray-800 px-4 py-2 border-t border-gray-700 text-xs text-gray-400">
        <div className="flex justify-between items-center">
          <span>
            {activeSession ? `Session: ${activeSession.sessionId.slice(0, 8)}` : 'No active session'}
          </span>
          <div className="space-x-4">
            <span>Ctrl+C: Interrupt</span>
            <span>Ctrl+L: Clear</span>
            <span>Tab: Completion</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmbeddedTerminal;