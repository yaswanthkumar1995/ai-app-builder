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

interface EmbeddedTerminalProps {
  isVisible?: boolean;
}

const EmbeddedTerminal: React.FC<EmbeddedTerminalProps> = ({ isVisible = true }) => {
  const { token, user } = useAuthStore();
  const { currentProject } = useProjectStore();
  const [activeSession, setActiveSession] = useState<TerminalSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string>('');
  const [containerId, setContainerId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    if (isVisible && !initialized) {
      initializeTerminal();
      setInitialized(true);
    }
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isVisible, initialized, currentProject?.id]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  useEffect(() => {
    // Auto-focus the terminal when component mounts or when session becomes active
    if (terminalRef.current && activeSession) {
      terminalRef.current.focus();
    }
  }, [activeSession]);

  const initializeTerminal = async () => {
    if (!user) return;

    if (process.env.NODE_ENV === 'development') {
      console.log('Initializing terminal for user:', user.id);
    }
    setLoading(true);
    setConnecting(true);
    
    // Connect directly to WebSocket - no REST API needed
    connectToSocket();
  };

  const connectToSocket = () => {
    console.log('🔌 Connecting to terminal WebSocket...');
    console.log('🔧 Config:', config);
    console.log('👤 User:', user);
    console.log('🔑 Token:', token ? 'Present' : 'Missing');
    
    // Connect directly to terminal service on port 3004
    const baseUrl = config.apiGatewayUrl.replace(/^https?:\/\//, '').split(':')[0];
    const protocol = config.apiGatewayUrl.startsWith('https') ? 'https' : 'http';
    const socketUrl = `${protocol}://${baseUrl}:3004`;
    
    console.log('✅ Terminal connecting to:', socketUrl);
    console.log('🔧 Socket.IO options:', {
      auth: { token: token ? 'Present' : 'Missing', userId: user?.id },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 10000,
      transports: ['websocket', 'polling']
    });
    
    const socket = io(socketUrl, {
      auth: {
        token,
        userId: user?.id
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 10000,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('✅ Terminal WebSocket connected successfully');
      setConnecting(false);
      setLoading(false);
      
      // Create the actual terminal session via WebSocket
      socket.emit('create-terminal', {
        userId: user?.id,
        projectId: currentProject?.id,
        userEmail: user?.email,
        workspacePath: currentProject?.workspacePath
      });
    });

    socket.on('connect_error', (error: any) => {
      console.error('❌ Terminal WebSocket connection error:', error);
      setConnecting(false);
      setLoading(false);
      setOutput('❌ Terminal connection error. Please check if terminal service is running.\n');
      toast.error('Terminal connection failed');
    });

    socket.on('disconnect', (reason: string) => {
      console.log('⚠️ Terminal WebSocket disconnected:', reason);
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    });

    socket.on('terminal-error', (data: any) => {
      console.error('❌ Terminal error from server:', data);
      setConnecting(false);
      setLoading(false);
      setOutput(`❌ Terminal error: ${data.error || 'Unknown error'}\n`);
      toast.error(`Terminal error: ${data.error || 'Unknown error'}`);
    });

    socket.on('terminal-created', (data: any) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Terminal session created via WebSocket:', data);
      }
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
        if (data.data) {
          let rawOutput = data.data;
          if (process.env.NODE_ENV === 'development') {
            console.log('Raw terminal output:', JSON.stringify(rawOutput));
          }
          
          // Process ANSI escape sequences properly
          let processedOutput = rawOutput;
          
          // Handle clear screen sequences - MUST clear the entire terminal
          if (processedOutput.includes('\u001b[2J') || processedOutput.includes('\u001b[H\u001b[2J')) {
            if (process.env.NODE_ENV === 'development') {
              console.log('🧹 CLEAR SCREEN DETECTED - Clearing terminal');
            }
            setOutput(''); // Clear everything
            
            // Find content after the clear sequence
            let afterClear = processedOutput;
            if (afterClear.includes('\u001b[H\u001b[2J')) {
              afterClear = afterClear.split('\u001b[H\u001b[2J').pop() || '';
            } else if (afterClear.includes('\u001b[2J')) {
              afterClear = afterClear.split('\u001b[2J').pop() || '';
            }
            
            if (afterClear.trim()) {
              // Process the content that comes after clear
              processedOutput = afterClear;
            } else {
              return; // Nothing after clear, just return
            }
          }
          
          // Handle form feed (Ctrl+L) - also clears screen
          if (processedOutput.includes('\x0c') || processedOutput.includes('\f')) {
            if (process.env.NODE_ENV === 'development') {
              console.log('🧹 FORM FEED DETECTED - Clearing terminal');
            }
            setOutput('');
            
            // Get content after form feed
            let afterFF = processedOutput.split(/[\x0c\f]/).pop() || '';
            if (afterFF.trim()) {
              processedOutput = afterFF;
            } else {
              return;
            }
          }
          
          // Skip initialization messages
          if (processedOutput.includes('export PS1=') || 
              processedOutput.includes('bind "set') || 
              processedOutput.includes('stty -echo') ||
              processedOutput.includes('stty echo')) {
            return;
          }
          
          // Clean ANSI escape sequences but preserve content structure
          let cleanOutput = processedOutput
            // Remove cursor positioning
            .replace(/\x1b\[H/g, '')
            .replace(/\x1b\[\d+;\d+H/g, '')
            // Remove other ANSI sequences
            .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
            .replace(/\x1b[()][AB0]/g, '')
            .replace(/\x1b[=>]/g, '')
            .replace(/\x07/g, '') // Bell
            .replace(/\x08/g, '') // Backspace
            .replace(/\x0E/g, '') // Shift out
            .replace(/\x0F/g, '') // Shift in
            // Handle line endings more carefully - preserve terminal formatting
            .replace(/\r\n/g, '\n')  // Convert Windows-style line endings
            .replace(/\r(?!\n)/g, ''); // Remove standalone carriage returns (don't convert to newline)
          
          // Only add to output if there's actual content
          if (cleanOutput.length > 0) {
            setOutput(prev => prev + cleanOutput);
          }
        }
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
      if (process.env.NODE_ENV === 'development') {
        console.log('Terminal disconnected');
      }
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
    if (socketRef.current && user && activeSession) {
      // Try both sessionId and userId for compatibility
      socketRef.current.emit('terminal-input', {
        sessionId: activeSession.sessionId,
        userId: user.id,
        data: input
      });
      console.log('Sending terminal input:', JSON.stringify(input), 'sessionId:', activeSession.sessionId);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!activeSession || !socketRef.current) return;

    event.preventDefault();
    
    const key = event.key;
    let input = '';

    console.log('Key pressed:', key, 'Ctrl:', event.ctrlKey, 'Alt:', event.altKey, 'Meta:', event.metaKey);

    // Handle control key combinations first
    if (event.ctrlKey && !event.altKey && !event.metaKey) {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'c') {
        input = '\x03'; // Ctrl+C
        console.log('Sending Ctrl+C');
      } else if (lowerKey === 'd') {
        input = '\x04'; // Ctrl+D
        console.log('Sending Ctrl+D');
      } else if (lowerKey === 'l') {
        input = '\x0c'; // Ctrl+L (clear)
        console.log('Sending Ctrl+L (clear)');
      } else if (lowerKey === 'z') {
        input = '\x1a'; // Ctrl+Z
      } else if (lowerKey === 'a') {
        input = '\x01'; // Ctrl+A (beginning of line)
      } else if (lowerKey === 'e') {
        input = '\x05'; // Ctrl+E (end of line)
      } else if (lowerKey === 'k') {
        input = '\x0b'; // Ctrl+K (kill line)
      } else if (lowerKey === 'u') {
        input = '\x15'; // Ctrl+U (kill line backwards)
      } else if (lowerKey === 'w') {
        input = '\x17'; // Ctrl+W (kill word)
      } else if (lowerKey === 'r') {
        input = '\x12'; // Ctrl+R (reverse search)
      }
    } 
    // Handle special keys
    else if (key === 'Enter') {
      input = '\r';
    } else if (key === 'Delete') {
      // Detect platform using modern API with fallback
      const isMac = (() => {
        // Modern approach using userAgentData (when available)
        if ('userAgentData' in navigator && (navigator as any).userAgentData?.platform) {
          return (navigator as any).userAgentData.platform.toLowerCase() === 'macos';
        }
        // Fallback to userAgent string parsing
        return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
      })();
      
      if (isMac) {
        // On Mac, the "Delete" key functions as backspace
        input = '\x7f'; // Same as backspace
        console.log('Delete key pressed (Mac backspace), sending:', JSON.stringify(input));
      } else {
        // On Windows/Linux, Delete key is forward delete
        input = '\x1b[3~'; // Forward delete escape sequence
        console.log('Delete key pressed (Windows forward delete), sending:', JSON.stringify(input));
      }
    } else if (key === 'Backspace') {
      input = '\x7f'; // DEL character (127)
    } else if (key === 'Tab') {
      input = '\t';
    } else if (key === 'ArrowUp') {
      input = '\x1b[A';
    } else if (key === 'ArrowDown') {
      input = '\x1b[B';
    } else if (key === 'ArrowRight') {
      input = '\x1b[C';
    } else if (key === 'ArrowLeft') {
      input = '\x1b[D';
    } else if (key === 'Home') {
      input = '\x1b[H';
    } else if (key === 'End') {
      input = '\x1b[F';
    } else if (key === 'PageUp') {
      input = '\x1b[5~';
    } else if (key === 'PageDown') {
      input = '\x1b[6~';
    } else if (key === 'Insert') {
      input = '\x1b[2~';
    } else if (key === 'Escape') {
      input = '\x1b';
    } 
    // Handle function keys
    else if (key.startsWith('F')) {
      const fNum = parseInt(key.slice(1));
      if (fNum >= 1 && fNum <= 12) {
        const fKeyCodes = {
          1: '\x1bOP', 2: '\x1bOQ', 3: '\x1bOR', 4: '\x1bOS',
          5: '\x1b[15~', 6: '\x1b[17~', 7: '\x1b[18~', 8: '\x1b[19~',
          9: '\x1b[20~', 10: '\x1b[21~', 11: '\x1b[23~', 12: '\x1b[24~'
        };
        input = fKeyCodes[fNum as keyof typeof fKeyCodes] || '';
      }
    }
    // Handle regular printable characters
    else if (key.length === 1) {
      input = key;
    }

    if (input) {
      console.log('Sending key input:', JSON.stringify(input), 'for key:', key);
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
        onClick={() => terminalRef.current?.focus()}
        onFocus={() => console.log('Terminal focused')}
        onBlur={() => console.log('Terminal blurred')}
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

    </div>
  );
};

export default EmbeddedTerminal;