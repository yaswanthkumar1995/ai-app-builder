import React, { useState, useRef, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { FolderIcon, ChatBubbleLeftRightIcon, XMarkIcon, CommandLineIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../stores/authStore';
import { config } from '../config';
import FileTree from './FileTree';
import SidebarChat from './SidebarChat';
import EmbeddedTerminal from './EmbeddedTerminal';
import { useProjectStore, FileNode } from '../stores/projectStore';
import toast from 'react-hot-toast';
import { GitOperations } from '../utils/gitOperations';

const normalizeRepoIdentifier = (url?: string) => {
  if (!url) return '';

  return url
    .replace(/^https?:\/\/(www\.)?github.com\//i, '')
    .replace(/^git@github.com:/i, '')
    .replace(/\.git$/i, '')
    .trim()
    .toLowerCase();
};

const CodeEditor: React.FC = () => {
  const {
    currentProject,
    selectedFile,
    selectFile,
    createFile,
    updateFile,
    deleteFile,
    renameFile,
    restructureCurrentProject,
    createProject,
  } = useProjectStore();

  const [editorContent, setEditorContent] = useState(selectedFile?.content || '');
  const [showFileTree, setShowFileTree] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(300);
  const editorRef = useRef<any>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const { token, user } = useAuthStore();
  const [repos, setRepos] = useState<any[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [repoError, setRepoError] = useState<string | null>(null);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [reposLoading, setReposLoading] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [syncingRepo, setSyncingRepo] = useState(false);
  const [syncMessage, setSyncMessage] = useState('Select a repository to get started');
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const gitOpsRef = useRef<GitOperations | null>(null);
  const lastSyncKeyRef = useRef<string | null>(null);
  const syncInFlightRef = useRef(false);

  useEffect(() => {
    if (token && user?.id) {
      gitOpsRef.current = new GitOperations(token, user.id);
    } else {
      gitOpsRef.current = null;
    }
  }, [token, user?.id]);

  const fetchRepos = useCallback(async () => {
    if (!token) return [] as any[];
    setReposLoading(true);
    setRepoError(null);
    try {
      const resp = await fetch(`${config.apiGatewayUrl}/api/auth/github/repos`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) {
        const errorBody = await resp.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Failed to load repositories from GitHub');
      }

      const data = await resp.json();
      const repoList = data.repos || [];
      setRepos(repoList);

      if (repoList.length === 0) {
        setRepoError('No repositories available for this account');
      }

      return repoList;
    } catch (error: any) {
      console.error('Failed to fetch repositories', error);
      setRepos([]);
      const message = error?.message || 'Unable to load repositories from GitHub';
      setRepoError(message);
      toast.error(message);
      return [];
    } finally {
      setReposLoading(false);
    }
  }, [token]);

  const fetchBranches = useCallback(async (fullName: string) => {
    if (!token || !fullName) return [] as string[];
    setBranchesLoading(true);
    setBranchError(null);
    try {
      const resp = await fetch(`${config.apiGatewayUrl}/api/auth/github/branches?repo=${encodeURIComponent(fullName)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) {
        const errorBody = await resp.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Failed to load branches');
      }

      const data = await resp.json();
      const branchNames = (data.branches || []).map((b: any) => b.name || b).filter(Boolean);
      setBranches(branchNames);

      if (branchNames.length === 0) {
        setBranchError('No branches found for this repository');
      }

      return branchNames;
    } catch (error: any) {
      console.error('Failed to fetch branches', error);
      setBranches([]);
      const message = error?.message || 'Unable to load branches';
      setBranchError(message);
      toast.error(message);
      return [];
    } finally {
      setBranchesLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchRepos();
    } else {
      setRepos([]);
    }
  }, [token, fetchRepos]);

  useEffect(() => {
    if (selectedRepo && !repos.some((repo) => repo.fullName === selectedRepo)) {
      setSelectedRepo('');
      setSelectedBranch('');
      setBranches([]);
      lastSyncKeyRef.current = null;
    }
  }, [repos, selectedRepo]);

  const handleRepoChange = useCallback(async (repoFullName: string) => {
    setSelectedRepo(repoFullName);
    setSelectedBranch('');
    setBranches([]);
    setBranchError(null);
    lastSyncKeyRef.current = null;

    if (!repoFullName) {
      setSyncState('idle');
      setSyncMessage('Select a repository to get started');
      return [] as string[];
    }

    const repo = repos.find((r) => r.fullName === repoFullName);
    if (!repo) {
      return [] as string[];
    }

    const branchNames = await fetchBranches(repo.fullName);
    if (branchNames.length > 0) {
      const preferredBranch = branchNames.includes(repo.defaultBranch)
        ? repo.defaultBranch
        : branchNames[0];
      setSelectedBranch(preferredBranch);
    }

    return branchNames;
  }, [fetchBranches, repos]);

  const handleBranchChange = useCallback((branchName: string) => {
    setSelectedBranch(branchName);
    if (branchName) {
      lastSyncKeyRef.current = null;
    }
  }, []);

  const syncRepository = useCallback(async (repoFullName: string, branchName: string) => {
    console.log('🔄 syncRepository called:', { repoFullName, branchName });
    
    const gitOps = gitOpsRef.current;
    if (!gitOps || !user?.id) {
      const error = 'You must be signed in to sync repositories';
      console.error('❌ Sync failed - not authenticated:', { hasGitOps: !!gitOps, userId: user?.id });
      throw new Error(error);
    }

    const repo = repos.find((r) => r.fullName === repoFullName);
    if (!repo) {
      console.error('❌ Sync failed - repository not found:', { repoFullName, availableRepos: repos.map(r => r.fullName) });
      throw new Error('Repository not found');
    }

    console.log('✅ Repository found:', { name: repo.name, cloneUrl: repo.cloneUrl });

    try {
      setSyncingRepo(true);
      setSyncState('syncing');
      setSyncMessage(`Syncing ${repo.name} (${branchName})…`);

      console.log('📡 Ensuring terminal session...');
      await gitOps.ensureTerminalSession(undefined, user.email);
      console.log('✅ Terminal session ready');

      let workspaceState: any = null;
      try {
        console.log('📡 Getting workspace state...');
        workspaceState = await gitOps.getWorkspaceState();
        console.log('✅ Workspace state:', workspaceState);
      } catch (workspaceError) {
        console.warn('⚠️ Workspace state unavailable, continuing with sync', workspaceError);
      }

      const normalize = (url?: string) => normalizeRepoIdentifier(url || '');
      const targetRepoId = normalize(repo.cloneUrl || repo.sshUrl);
      const currentRepoId = normalize(workspaceState?.repoUrl);
      
      console.log('🔍 Checking if clone needed:', { 
        targetRepoId, 
        currentRepoId,
        needsClone: !currentRepoId || currentRepoId !== targetRepoId,
        currentBranch: workspaceState?.currentBranch,
        targetBranch: branchName
      });

      if (!currentRepoId || currentRepoId !== targetRepoId) {
        console.log('🚀 Cloning repository:', { repoUrl: repo.cloneUrl, branch: branchName });
        await gitOps.executeGitOperation({
          type: 'clone',
          repoUrl: repo.cloneUrl,
          branch: branchName,
          userId: user.id,
          projectName: repo.name,
        });
        console.log('✅ Clone completed successfully');
      } else if (workspaceState?.currentBranch !== branchName) {
        console.log('🔀 Checking out branch:', branchName);
        await gitOps.executeGitOperation({
          type: 'checkout',
          branch: branchName,
          userId: user.id,
        });
        console.log('✅ Checkout completed successfully');
      } else {
        console.log('ℹ️ Repository already on correct branch, skipping clone/checkout');
      }

      // Load files from workspace
      console.log('📂 Loading workspace files...');
      const files = await gitOps.getWorkspaceFiles();
      console.log('✅ Workspace files loaded:', files.length, 'items');
      
      // Create or update project with files
      if (files && files.length > 0) {
        const projectName = repo.name;
        const existingProject = currentProject;
        
        if (!existingProject || existingProject.githubRepo !== repoFullName || existingProject.githubBranch !== branchName) {
          // Create new project with GitHub files
          console.log('🆕 Creating project with GitHub files');
          createProject(
            projectName,
            `Cloned from ${repoFullName}`,
            {
              repo: repoFullName,
              branch: branchName,
              files: files,
              workspacePath: workspaceState?.workspacePath
            }
          );
        }
      }

      setSyncState('success');
      setSyncMessage(`Ready on ${repo.name}:${branchName}`);
      console.log('✅ Sync completed successfully');
      toast.success(`Workspace synced with ${repo.name} (${branchName})`);
    } catch (error: any) {
      console.error('Repository sync failed', error);
      const message = error?.message || 'Failed to sync repository';
      setSyncState('error');
      setSyncMessage(message);
      toast.error(message);
      throw error;
    } finally {
      setSyncingRepo(false);
    }
  }, [repos, user, currentProject, createProject]);

  useEffect(() => {
    const hydrateWorkspaceSelection = async () => {
      if (!gitOpsRef.current || !user?.id || repos.length === 0 || selectedRepo) {
        return;
      }

      try {
        await gitOpsRef.current.ensureTerminalSession(undefined, user.email);
        const state = await gitOpsRef.current.getWorkspaceState();
        if (!state?.repoUrl) {
          return;
        }

        const targetRepo = repos.find((repo) => normalizeRepoIdentifier(repo.cloneUrl) === normalizeRepoIdentifier(state.repoUrl));
        if (!targetRepo) {
          return;
        }

        const branchNames = await handleRepoChange(targetRepo.fullName);
        if (state.currentBranch && branchNames.includes(state.currentBranch)) {
          setSelectedBranch(state.currentBranch);
        }
      } catch (error) {
        console.warn('Unable to restore workspace selection', error);
      }
    };

    hydrateWorkspaceSelection();
  }, [handleRepoChange, repos, selectedRepo, user?.email, user?.id]);

  useEffect(() => {
    if (!selectedRepo || !selectedBranch || reposLoading || branchesLoading) {
      console.log('Skipping sync:', { selectedRepo, selectedBranch, reposLoading, branchesLoading });
      return;
    }

    const syncKey = `${selectedRepo}:${selectedBranch}`;
    if (lastSyncKeyRef.current === syncKey || syncInFlightRef.current) {
      console.log('Skipping sync - already synced or in progress:', { syncKey, lastSync: lastSyncKeyRef.current, inFlight: syncInFlightRef.current });
      return;
    }

    console.log('Starting repository sync:', { selectedRepo, selectedBranch });
    syncInFlightRef.current = true;
    syncRepository(selectedRepo, selectedBranch)
      .then(() => {
        console.log('Repository sync successful:', syncKey);
        lastSyncKeyRef.current = syncKey;
      })
      .catch((error) => {
        console.error('Repository sync failed:', error);
        // keep lastSyncKeyRef null to allow retries on next change
      })
      .finally(() => {
        syncInFlightRef.current = false;
      });
  }, [selectedRepo, selectedBranch, reposLoading, branchesLoading, syncRepository]);

  useEffect(() => {
    if (selectedFile) {
      setEditorContent(selectedFile.content || '');
    }
  }, [selectedFile]);

  // Automatically restructure project when it loads to ensure proper folder hierarchy
  useEffect(() => {
    if (currentProject) {
      restructureCurrentProject();
    }
  }, [currentProject?.id, restructureCurrentProject]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        handleChatToggle();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        handleTerminalToggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Terminal resize functionality
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizerRef.current && showTerminal) {
        const containerRect = resizerRef.current.parentElement?.getBoundingClientRect();
        if (containerRect) {
          const newHeight = containerRect.bottom - e.clientY;
          const minHeight = 150;
          const maxHeight = containerRect.height * 0.7;
          setTerminalHeight(Math.max(minHeight, Math.min(maxHeight, newHeight)));
        }
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.target === resizerRef.current) {
        e.preventDefault();
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
      }
    };

    if (resizerRef.current) {
      resizerRef.current.addEventListener('mousedown', handleMouseDown);
    }

    return () => {
      if (resizerRef.current) {
        resizerRef.current.removeEventListener('mousedown', handleMouseDown);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [showTerminal]);

  const handleFileSelect = (file: FileNode) => {
    selectFile(file);
  };

  const handleFileCreate = (parentPath: string, name: string, type: 'file' | 'folder') => {
    const fileName = name === 'new-file' ? 'untitled.js' : name === 'new-folder' ? 'untitled-folder' : name;
    const content = type === 'file' ? '// New file\n' : undefined;
    
    createFile(parentPath, fileName, type, content);
    toast.success(`${type === 'file' ? 'File' : 'Folder'} created successfully`);
  };

  const handleFileDelete = (filePath: string) => {
    deleteFile(filePath);
    toast.success('File deleted successfully');
  };

  const handleFileRename = (filePath: string, newName: string) => {
    renameFile(filePath, newName);
    toast.success('File renamed successfully');
  };

  const handleEditorChange = (value: string | undefined) => {
    setEditorContent(value || '');
    
    if (selectedFile) {
      updateFile(selectedFile.path, value || '');
    }
  };



  const handleChatToggle = () => {
    setShowChat(!showChat);
  };

  const handleTerminalToggle = () => {
    setShowTerminal(!showTerminal);
  };

  const getLanguageFromPath = (path: string): string => {
    const extension = path.split('.').pop()?.toLowerCase();
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'md': 'markdown',
      'yml': 'yaml',
      'yaml': 'yaml',
    };
    return languageMap[extension || ''] || 'plaintext';
  };

  return (
    <div className="flex h-full bg-gray-900">
      {/* File Tree Sidebar */}
      {showFileTree && (
        <div className="w-80 flex-shrink-0">
          <FileTree
            files={currentProject?.files || []}
            selectedFile={selectedFile?.path}
            onFileSelect={handleFileSelect}
            onFileCreate={handleFileCreate}
            onFileDelete={handleFileDelete}
            onFileRename={handleFileRename}
            repos={repos}
            branches={branches}
            selectedRepo={selectedRepo}
            selectedBranch={selectedBranch}
            repoError={repoError}
            branchError={branchError}
            reposLoading={reposLoading}
            branchesLoading={branchesLoading}
            onRepoChange={handleRepoChange}
            onBranchChange={handleBranchChange}
            onRefreshRepos={fetchRepos}
          />
        </div>
      )}

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Editor Header */}
        <div className="border-b border-gray-700 p-2 bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowFileTree(!showFileTree)}
                className="p-2 hover:bg-gray-700 rounded-md text-gray-400 hover:text-white"
                title="Toggle file tree"
              >
                <FolderIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex items-center space-x-1">
              <button
                onClick={handleTerminalToggle}
                className={`p-2 rounded-lg border-2 focus:outline-none transition-all duration-200 ${
                  showTerminal 
                    ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-700 shadow-lg' 
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-gray-500'
                }`}
                title={showTerminal ? "Hide Terminal (Ctrl+`)" : "Show Terminal (Ctrl+`)"}
              >
                <CommandLineIcon className="h-5 w-5" />
              </button>
              <button
                onClick={handleChatToggle}
                className={`p-2 rounded-lg border-2 focus:outline-none transition-all duration-200 ${
                  showChat 
                    ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-700 shadow-lg' 
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-gray-500'
                }`}
                title={showChat ? "Hide Chat (Ctrl+Shift+C)" : "Show Chat (Ctrl+Shift+C)"}
              >
                <ChatBubbleLeftRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 flex flex-col">
          {/* Main Editor and Chat Area */}
          <div className={`flex transition-all duration-300 ${showTerminal ? `flex-1` : 'h-full'}`}>
            {/* Code Editor Area */}
            <div className={`${showChat ? 'flex-1' : 'w-full'} transition-all duration-300`}>
              {selectedFile ? (
                <Editor
                  height="100%"
                  language={getLanguageFromPath(selectedFile.path)}
                  value={editorContent}
                  onChange={handleEditorChange}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    roundedSelection: false,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    insertSpaces: true,
                    wordWrap: 'on',
                    suggestOnTriggerCharacters: true,
                    acceptSuggestionOnEnter: 'on',
                    quickSuggestions: true,
                  }}
                  onMount={(editor) => {
                    editorRef.current = editor;
                  }}
                />
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-900">
                  <div className="text-center text-gray-400">
                    <div className="text-6xl mb-4">📝</div>
                    <h3 className="text-xl font-semibold mb-2">No file selected</h3>
                    <p className="text-sm">Select a file from the sidebar to start editing</p>
                    <p className="text-xs mt-2">Or create a new file to get started</p>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Panel */}
            {showChat && (
              <div className="w-80 min-w-80 max-w-96 border-l border-gray-700 bg-gray-900 flex flex-col transition-all duration-300 ease-in-out">
                {/* Chat Header */}
                <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800">
                  <h3 className="text-sm font-semibold text-white flex items-center">
                    <ChatBubbleLeftRightIcon className="h-4 w-4 mr-2" />
                    AI Assistant
                  </h3>
                  <button
                    onClick={() => setShowChat(false)}
                    className="p-1 hover:bg-gray-700 rounded-md text-gray-400 hover:text-white transition-colors"
                    title="Close Chat"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
                
                {/* Chat Content */}
                <div className="flex-1 overflow-hidden">
                  <SidebarChat 
                    currentFile={selectedFile ? {
                      name: selectedFile.name,
                      path: selectedFile.path,
                      content: editorContent,
                      language: getLanguageFromPath(selectedFile.path)
                    } : undefined}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Terminal Panel */}
          {showTerminal && (
            <>
              {/* Terminal Resizer */}
              <div 
                ref={resizerRef}
                className="h-1 bg-gray-700 hover:bg-blue-500 cursor-row-resize transition-colors flex-shrink-0"
                title="Drag to resize terminal"
              />
              
              {/* Terminal Content */}
              <div 
                className="bg-gray-900 border-t border-gray-700 flex-shrink-0 transition-all duration-300"
                style={{ height: `${terminalHeight}px` }}
              >
                <div className="h-full flex flex-col">
                  {/* Terminal Header */}
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                    <div className="flex items-center space-x-2">
                      <CommandLineIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-white">Terminal</span>
                      {currentProject && (
                        <span className="text-xs text-gray-400">
                          - {currentProject.name}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setShowTerminal(false)}
                      className="p-1 hover:bg-gray-700 rounded-md text-gray-400 hover:text-white transition-colors"
                      title="Close Terminal"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                  
                  {/* Terminal Content */}
                  <div className="flex-1 overflow-hidden">
                    <EmbeddedTerminal />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
