import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { FolderIcon, ChatBubbleLeftRightIcon, XMarkIcon, CommandLineIcon, ArrowPathIcon, DocumentIcon } from '@heroicons/react/24/outline';
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

type StoredEditorPreferences = {
  showTerminal?: boolean;
  terminalHeight?: number;
  selectedRepo?: string;
  selectedBranch?: string;
};

const PREFERENCES_STORAGE_KEY = 'ai-app-builder:code-editor-preferences';

const loadStoredPreferences = (): StoredEditorPreferences => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as StoredEditorPreferences;
    }

    return {};
  } catch (error) {
    console.warn('Failed to read editor preferences from storage', error);
    return {};
  }
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
    openTabs,
    closeTab,
    getFileByPath,
  } = useProjectStore();

  const storedPreferencesRef = useRef<StoredEditorPreferences | null>(null);
  if (storedPreferencesRef.current === null) {
    storedPreferencesRef.current = loadStoredPreferences();
  }
  const initialPreferences = storedPreferencesRef.current || {};
  const initialShowTerminal = initialPreferences.showTerminal ?? false;
  const initialTerminalHeight = typeof initialPreferences.terminalHeight === 'number' && !Number.isNaN(initialPreferences.terminalHeight)
    ? initialPreferences.terminalHeight
    : 300;
  const initialSelectedRepo = initialPreferences.selectedRepo ?? '';
  const initialSelectedBranch = initialPreferences.selectedBranch ?? '';

  const [editorContent, setEditorContent] = useState(selectedFile?.content || '');
  const [showFileTree, setShowFileTree] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showTerminal, setShowTerminal] = useState<boolean>(() => initialShowTerminal);
  const [terminalHeight, setTerminalHeight] = useState<number>(() => initialTerminalHeight);
  const [fileTreeWidth, setFileTreeWidth] = useState(320);
  const [chatWidth, setChatWidth] = useState(320);
  const MIN_EDITOR_WIDTH = 360;
  const MIN_FILETREE_WIDTH = 220;
  const MIN_CHAT_WIDTH = 260;
  const editorRef = useRef<any>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const fileTreeWidthRef = useRef(fileTreeWidth);
  const chatWidthRef = useRef(chatWidth);
  const { token, user } = useAuthStore();
  const [repos, setRepos] = useState<any[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>(() => initialSelectedRepo);
  const [selectedBranch, setSelectedBranch] = useState<string>(() => initialSelectedBranch);
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
  const shouldHydrateSelectionRef = useRef<boolean>(Boolean(initialSelectedRepo));
  const openTabNodes = useMemo(
    () =>
      openTabs
        .map((path) => getFileByPath(path))
        .filter((node): node is FileNode => Boolean(node)),
    [getFileByPath, openTabs]
  );

  useEffect(() => {
    fileTreeWidthRef.current = fileTreeWidth;
  }, [fileTreeWidth]);

  useEffect(() => {
    chatWidthRef.current = chatWidth;
  }, [chatWidth]);

  useEffect(() => {
    if (token && user?.id) {
      gitOpsRef.current = new GitOperations(token, user.id);
    } else {
      gitOpsRef.current = null;
    }
  }, [token, user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const preferencesToPersist: StoredEditorPreferences = {
      showTerminal,
      terminalHeight,
      selectedRepo,
      selectedBranch,
    };

    try {
      window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferencesToPersist));
    } catch (error) {
      console.warn('Failed to persist editor preferences', error);
    }
  }, [showTerminal, terminalHeight, selectedRepo, selectedBranch]);

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
    if (!selectedRepo) {
      return;
    }

    if (!repos || repos.length === 0) {
      return;
    }

    if (!repos.some((repo) => repo.fullName === selectedRepo)) {
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

  useEffect(() => {
    if (!shouldHydrateSelectionRef.current) {
      return;
    }

    if (!selectedRepo) {
      shouldHydrateSelectionRef.current = false;
      return;
    }

    if (!repos || repos.length === 0 || reposLoading || branchesLoading) {
      return;
    }

    if (!repos.some((repo) => repo.fullName === selectedRepo)) {
      setSelectedRepo('');
      setSelectedBranch('');
      setBranches([]);
      shouldHydrateSelectionRef.current = false;
      return;
    }

    (async () => {
      try {
        const branchNames = await handleRepoChange(selectedRepo);
        const persistedBranch = storedPreferencesRef.current?.selectedBranch;
        if (persistedBranch && branchNames.includes(persistedBranch)) {
          setSelectedBranch(persistedBranch);
        }
      } catch (error) {
        console.warn('Failed to hydrate stored repository selection', error);
      } finally {
        shouldHydrateSelectionRef.current = false;
      }
    })();
  }, [branchesLoading, handleRepoChange, repos, reposLoading, selectedRepo]);

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
          userEmail: user.email,
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
      console.log('📋 Files data:', JSON.stringify(files.slice(0, 3), null, 2));
      
      // Create or update project with files
      if (files && files.length > 0) {
        const projectName = repo.name;
        const existingProject = currentProject;
        
        console.log('🔍 Current project check:', {
          hasProject: !!existingProject,
          currentRepo: existingProject?.githubRepo,
          currentBranch: existingProject?.githubBranch,
          newRepo: repoFullName,
          newBranch: branchName,
          needsCreate: !existingProject || existingProject.githubRepo !== repoFullName || existingProject.githubBranch !== branchName
        });
        
        if (!existingProject || existingProject.githubRepo !== repoFullName || existingProject.githubBranch !== branchName) {
          // Create new project with GitHub files
          console.log('🆕 Creating project with GitHub files, count:', files.length);
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
          console.log('✅ Project created/updated in store');
        } else {
          console.log('ℹ️ Project already exists with same repo/branch, skipping create');
        }
      } else {
        console.warn('⚠️ No files returned from workspace');
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

  const clampPanelWidths = useCallback(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();

    if (showFileTree) {
      const availableWidth = rect.width - (showChat ? chatWidthRef.current : 0) - MIN_EDITOR_WIDTH;
      const maxWidth = Math.max(MIN_FILETREE_WIDTH, availableWidth);
      setFileTreeWidth((prev) => {
        const next = Math.max(MIN_FILETREE_WIDTH, Math.min(maxWidth, prev));
        fileTreeWidthRef.current = next;
        return next;
      });
    }

    if (showChat) {
      const availableWidth = rect.width - (showFileTree ? fileTreeWidthRef.current : 0) - MIN_EDITOR_WIDTH;
      const maxWidth = Math.max(MIN_CHAT_WIDTH, availableWidth);
      setChatWidth((prev) => {
        const next = Math.max(MIN_CHAT_WIDTH, Math.min(maxWidth, prev));
        chatWidthRef.current = next;
        return next;
      });
    }
  }, [showChat, showFileTree]);

  const startFileTreeResize = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !showFileTree) return;
    event.preventDefault();

    const container = editorContainerRef.current;
    if (!container) return;

    const startX = event.clientX;
  const startWidth = fileTreeWidthRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const availableWidth = rect.width - (showChat ? chatWidthRef.current : 0) - MIN_EDITOR_WIDTH;
      const maxWidth = Math.max(MIN_FILETREE_WIDTH, availableWidth);
      const dx = e.clientX - startX;
      const nextWidth = startWidth + dx;
      const clamped = Math.max(MIN_FILETREE_WIDTH, Math.min(maxWidth, nextWidth));
      setFileTreeWidth(clamped);
      fileTreeWidthRef.current = clamped;
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [showChat, showFileTree, chatWidthRef]);

  const startChatResize = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !showChat) return;
    event.preventDefault();

    const container = editorContainerRef.current;
    if (!container) return;

    const startX = event.clientX;
  const startWidth = chatWidthRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const availableWidth = rect.width - (showFileTree ? fileTreeWidthRef.current : 0) - MIN_EDITOR_WIDTH;
      const maxWidth = Math.max(MIN_CHAT_WIDTH, availableWidth);
      const dx = e.clientX - startX;
      const nextWidth = startWidth - dx;
      const clamped = Math.max(MIN_CHAT_WIDTH, Math.min(maxWidth, nextWidth));
      setChatWidth(clamped);
      chatWidthRef.current = clamped;
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [showChat, showFileTree, fileTreeWidthRef]);

  useEffect(() => {
    clampPanelWidths();
  }, [clampPanelWidths]);

  useEffect(() => {
    const handleResize = () => clampPanelWidths();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPanelWidths]);

  const handleFileSelect = (file: FileNode) => {
    selectFile(file);
  };

  const handleFileCreate = (parentPath: string, name: string, type: 'file' | 'folder') => {
    const effectiveParent = parentPath && parentPath !== '' ? parentPath : '/';
    const defaultName = name && name.trim().length > 0
      ? name.trim()
      : type === 'file'
        ? 'untitled.ts'
        : 'untitled-folder';
    const content = type === 'file' ? '// New file\n' : undefined;

    createFile(effectiveParent, defaultName, type, content);
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

  const handleTabSelect = useCallback((filePath: string) => {
    const fileNode = getFileByPath(filePath);
    if (fileNode) {
      selectFile(fileNode);
    }
  }, [getFileByPath, selectFile]);

  const handleTabClose = useCallback((event: React.MouseEvent, filePath: string) => {
    event.stopPropagation();
    closeTab(filePath);
  }, [closeTab]);

  const copyTextToClipboard = useCallback(async (text: string) => {
    if (typeof window === 'undefined') {
      return false;
    }

    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        console.warn('Clipboard write failed', error);
      }
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      return successful;
    } catch (error) {
      console.warn('Fallback clipboard copy failed', error);
      return false;
    }
  }, []);

  const handleCopyFile = useCallback(async (file: FileNode) => {
    const success = await copyTextToClipboard(file.path);
    if (success) {
      toast.success(`Copied path for ${file.name}`);
    } else {
      toast.error('Unable to copy file path to clipboard');
    }
  }, [copyTextToClipboard]);

  const handleCutFile = useCallback(async (file: FileNode) => {
    const success = await copyTextToClipboard(file.path);
    if (success) {
      toast.success(`Marked ${file.name} for moving (path copied)`);
    } else {
      toast.error('Unable to cut file');
    }
  }, [copyTextToClipboard]);

  const handleAddFileToChat = useCallback((file: FileNode) => {
    selectFile(file);
    setShowChat(true);
    toast.success(`Added ${file.name} to chat context`);
  }, [selectFile]);

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

  const getLanguageLabel = (path: string): string => {
    const extension = path.split('.').pop()?.toLowerCase();
    if (!extension) return 'PLAINTEXT';
    const labelMap: { [key: string]: string } = {
      'js': 'JAVASCRIPT',
      'jsx': 'JAVASCRIPT',
      'ts': 'TYPESCRIPT',
      'tsx': 'TYPESCRIPT',
      'py': 'PYTHON',
      'html': 'HTML',
      'css': 'CSS',
      'json': 'JSON',
      'md': 'MARKDOWN',
      'yml': 'YAML',
      'yaml': 'YAML',
      'sh': 'SHELL',
      'sql': 'SQL',
    };
    return (labelMap[extension] || extension.toUpperCase());
  };

  const renderPathBreadcrumb = (path: string) => {
    const parts = path.replace(/^\/+/, '').split('/');
    return parts.map((part, index) => (
      <span key={`${part}-${index}`} className="flex items-center text-xs text-gray-400">
        {index > 0 && <span className="mx-1 text-gray-600">/</span>}
        <span className={index === parts.length - 1 ? 'text-white font-medium truncate max-w-xs' : 'truncate max-w-xs'} title={part}>
          {part}
        </span>
      </span>
    ));
  };

  return (
    <div ref={editorContainerRef} className="flex h-full bg-gray-900">
      {/* File Tree Sidebar */}
      {showFileTree && (
        <>
          <div
            className="flex-shrink-0"
            style={{ width: `${fileTreeWidth}px`, minWidth: MIN_FILETREE_WIDTH, maxWidth: 640 }}
          >
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
              onAddFileToChat={handleAddFileToChat}
              onCopyFile={handleCopyFile}
              onCutFile={handleCutFile}
            />
          </div>
          <div
            onMouseDown={startFileTreeResize}
            className="relative w-2 bg-gray-800 hover:bg-blue-500/80 transition-colors cursor-col-resize flex-shrink-0"
            title="Drag to resize file explorer"
          >
            <span className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex items-center justify-center">
              <span className="h-10 w-0.5 rounded bg-gray-600/70" />
            </span>
          </div>
        </>
      )}

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Editor Header */}
        <div className="border-b border-gray-700 p-2 bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 overflow-hidden">
              <button
                onClick={() => setShowFileTree(!showFileTree)}
                className="p-2 hover:bg-gray-700 rounded-md text-gray-400 hover:text-white"
                title="Toggle file tree"
              >
                <FolderIcon className="h-5 w-5" />
              </button>
              {selectedFile ? (
                <div className="flex items-center space-x-2 overflow-hidden">
                  <DocumentIcon className="h-4 w-4 text-blue-400 flex-shrink-0" />
                  <div className="flex items-center space-x-1 overflow-hidden">
                    {renderPathBreadcrumb(selectedFile.path)}
                  </div>
                </div>
              ) : (
                <span className="text-xs text-gray-500">Select a file to start editing</span>
              )}
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

        {/* Open File Tabs */}
        {openTabNodes.length > 0 && (
          <div className="flex items-stretch bg-gray-900 border-b border-gray-800 overflow-x-auto" role="tablist">
            {openTabNodes.map((tab) => {
              const isActive = selectedFile?.path === tab.path;
              return (
                <button
                  key={tab.path}
                  onClick={() => handleTabSelect(tab.path)}
                  role="tab"
                  aria-selected={isActive}
                  className={`group flex items-center gap-2 px-4 py-2 text-xs font-medium border-r border-gray-800 border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-gray-900 text-white border-blue-500'
                      : 'bg-gray-900/70 text-gray-400 hover:text-white hover:bg-gray-800 border-transparent'
                  }`}
                >
                  <span className="uppercase text-[10px] tracking-wide text-blue-300/80 group-hover:text-blue-200">
                    {getLanguageLabel(tab.path)}
                  </span>
                  <span className="truncate max-w-[140px] text-left">
                    {tab.name}
                  </span>
                  <span
                    role="button"
                    aria-label={`Close ${tab.name}`}
                    className="ml-2 p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-white"
                    onClick={(event) => handleTabClose(event, tab.path)}
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    <XMarkIcon className="h-3.5 w-3.5" />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Editor Content */}
        <div className="flex-1 flex flex-col">
          {/* Main Editor and Chat Area */}
          <div className={`flex transition-all duration-300 ${showTerminal ? `flex-1` : 'h-full'}`}>
            {/* Code Editor Area */}
            <div className={`flex-1 min-w-0 transition-all duration-300`}>
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
              <>
                <div
                  onMouseDown={startChatResize}
                  className="relative w-2 bg-gray-800 hover:bg-blue-500/80 transition-colors cursor-col-resize flex-shrink-0"
                  title="Drag to resize chat"
                >
                  <span className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex items-center justify-center">
                    <span className="h-10 w-0.5 rounded bg-gray-600/70" />
                  </span>
                </div>
                <div
                  className="border-l border-gray-700 bg-gray-900 flex flex-col transition-all duration-300 ease-in-out"
                  style={{ width: `${chatWidth}px`, minWidth: MIN_CHAT_WIDTH, maxWidth: 560 }}
                >
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
              </>
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

        {/* Status Bar */}
        <div className="h-9 bg-gray-900 border-t border-gray-800 px-4 flex items-center justify-between text-xs text-gray-300">
          <div className="flex items-center space-x-2 overflow-hidden">
            <DocumentIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
            {selectedFile ? (
              <div className="flex items-center space-x-1 overflow-hidden">
                <span className="text-gray-200 font-medium truncate" title={selectedFile.name}>{selectedFile.name}</span>
                <span className="text-gray-600">•</span>
                <span className="truncate text-gray-400" title={selectedFile.path.replace(/^\/+/, '')}>
                  {selectedFile.path.replace(/^\/+/, '')}
                </span>
              </div>
            ) : (
              <span className="text-gray-500">No file selected</span>
            )}
          </div>

          <div className="flex items-center space-x-2 text-gray-400">
            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase ${
              syncState === 'success' ? 'bg-green-600/20 text-green-400 border border-green-500/40' :
              syncState === 'error' ? 'bg-red-600/20 text-red-400 border border-red-500/40' :
              syncState === 'syncing' ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 animate-pulse' :
              'bg-gray-700/40 text-gray-300 border border-gray-600/40'
            }`}>Workspace</span>
            <span className="truncate max-w-xs" title={syncMessage}>{syncMessage}</span>
          </div>

          <div className="flex items-center space-x-4 text-gray-400">
            {currentProject?.githubRepo && (
              <div className="flex items-center space-x-1" title={`${currentProject.githubRepo}${currentProject.githubBranch ? `:${currentProject.githubBranch}` : ''}`}>
                <svg className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.483 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.004.071 1.532 1.032 1.532 1.032.892 1.529 2.341 1.087 2.91.832.091-.647.35-1.087.636-1.337-2.22-.252-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.447-1.27.098-2.646 0 0 .84-.269 2.75 1.025A9.56 9.56 0 0 1 12 6.844a9.56 9.56 0 0 1 2.504.337c1.909-1.294 2.748-1.025 2.748-1.025.546 1.376.202 2.393.099 2.646.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.31.678.921.678 1.857 0 1.34-.012 2.421-.012 2.75 0 .268.18.58.688.482A10.003 10.003 0 0 0 22 12c0-5.523-4.477-10-10-10Z" clipRule="evenodd" />
                </svg>
                <span className="truncate max-w-xs">{currentProject.githubRepo}</span>
                {currentProject.githubBranch && (
                  <span className="text-gray-500">[{currentProject.githubBranch}]</span>
                )}
              </div>
            )}
            {selectedFile && (
              <span className="uppercase tracking-wide text-[10px]" title={getLanguageFromPath(selectedFile.path)}>
                {getLanguageLabel(selectedFile.path)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
