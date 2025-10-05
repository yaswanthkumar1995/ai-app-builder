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
  showChat?: boolean;
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
  const initialShowChat = initialPreferences.showChat ?? false;

  const [editorContent, setEditorContent] = useState(selectedFile?.content || '');
  const [showFileTree, setShowFileTree] = useState(true);
  const [showChat, setShowChat] = useState(initialShowChat);
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
  const tabContainerRef = useRef<HTMLDivElement>(null);
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
  const [editorContextMenu, setEditorContextMenu] = useState<{ x: number; y: number } | null>(null);
  const gitOpsRef = useRef<GitOperations | null>(null);
  const lastSyncKeyRef = useRef<string | null>(null);
  const syncInFlightRef = useRef(false);
  const shouldHydrateSelectionRef = useRef<boolean>(Boolean(initialSelectedRepo));
  const editorContextMenuRef = useRef<HTMLDivElement | null>(null);
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

  // Auto-scroll to show newly opened tabs
  useEffect(() => {
    if (tabContainerRef.current && openTabs.length > 0) {
      // Scroll to the rightmost position to show the latest tab
      const container = tabContainerRef.current;
      setTimeout(() => {
        container.scrollLeft = container.scrollWidth - container.clientWidth;
      }, 50); // Small delay to ensure DOM is updated
    }
  }, [openTabs.length]);

  useEffect(() => {
    if (token && user?.id) {
  gitOpsRef.current = new GitOperations(token, user.id, user.email, currentProject?.id, user.username);
    } else {
      gitOpsRef.current = null;
    }
  }, [token, user?.id, user?.email, currentProject?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const preferencesToPersist: StoredEditorPreferences = {
      showTerminal,
      terminalHeight,
      selectedRepo,
      selectedBranch,
      showChat,
    };

    try {
      window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferencesToPersist));
    } catch (error) {
      console.warn('Failed to persist editor preferences', error);
    }
  }, [showTerminal, terminalHeight, selectedRepo, selectedBranch, showChat]);

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

  // Keyboard shortcuts for file tab management
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Tab or Cmd+Tab - Switch between open files
      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
        e.preventDefault();
        if (openTabs.length > 1) {
          const currentIndex = selectedFile ? openTabs.indexOf(selectedFile.path) : -1;
          const nextIndex = (currentIndex + 1) % openTabs.length;
          const nextPath = openTabs[nextIndex];
          handleTabSelect(nextPath);
        }
      }
      // Ctrl+W or Cmd+W - Close current file
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (selectedFile) {
          closeTab(selectedFile.path);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openTabs, selectedFile, handleTabSelect, closeTab]);

  // Context menu close handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editorContextMenuRef.current && !editorContextMenuRef.current.contains(e.target as Node)) {
        setEditorContextMenu(null);
      }
    };

    if (editorContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [editorContextMenu]);

  const handleEditorContextMenu = (e: React.MouseEvent) => {
    if (!selectedFile) return;
    e.preventDefault();
    setEditorContextMenu({ x: e.clientX, y: e.clientY });
  };

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

  const handleAddFolderToChat = useCallback((folder: FileNode) => {
    setShowChat(true);
    toast.success(`Added folder ${folder.name} to chat context`);
  }, []);

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

  const isImageFile = (path: string): boolean => {
    const extension = path.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(extension || '');
  };

  const isPdfFile = (path: string): boolean => {
    const extension = path.split('.').pop()?.toLowerCase();
    return extension === 'pdf';
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
    <div ref={editorContainerRef} className="flex h-full bg-gray-900 overflow-hidden">
      {/* File Tree Sidebar */}
      {showFileTree && (
        <>
          <div
            className="flex-shrink-0 overflow-hidden"
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
              onAddFolderToChat={handleAddFolderToChat}
              onCopyFile={handleCopyFile}
              onCutFile={handleCutFile}
              onTerminalToggle={handleTerminalToggle}
              onChatToggle={handleChatToggle}
              showTerminal={showTerminal}
              showChat={showChat}
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

      {/* Main Content Area */}
      <div className="flex-1 flex min-w-0 overflow-hidden">
        {/* Editor Section */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Open File Tabs */}
          {openTabNodes.length > 0 && (
            <div 
              ref={tabContainerRef}
              className="flex-shrink-0 bg-gray-900 border-b border-gray-800 w-full overflow-x-auto overflow-y-hidden tab-scrollbar" 
              style={{ 
                maxWidth: '100%',
                scrollbarWidth: 'thin',
                scrollbarColor: '#6B7280 transparent'
              }}
            >
              <div className="flex items-stretch" role="tablist" style={{ minWidth: 'fit-content' }}>
                {openTabNodes.map((tab) => {
                  const isActive = selectedFile?.path === tab.path;
                  return (
                    <button
                      key={tab.path}
                      onClick={() => handleTabSelect(tab.path)}
                      role="tab"
                      aria-selected={isActive}
                      className={`group flex items-center gap-1 px-3 py-2 text-xs font-medium border-r border-gray-800 border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                        isActive
                          ? 'bg-gray-900 text-white border-blue-500'
                          : 'bg-gray-900/70 text-gray-400 hover:text-white hover:bg-gray-800 border-transparent'
                      }`}
                      style={{ maxWidth: '160px', minWidth: '80px' }}
                    >
                      <span className="truncate flex-1 text-left" style={{ maxWidth: '120px' }}>
                        {tab.name}
                      </span>
                      <span
                        role="button"
                        aria-label={`Close ${tab.name}`}
                        className="ml-1 p-0.5 rounded hover:bg-gray-700 text-gray-500 hover:text-white flex-shrink-0"
                        onClick={(event) => handleTabClose(event, tab.path)}
                        onMouseDown={(event) => event.stopPropagation()}
                      >
                        <XMarkIcon className="h-3 w-3" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Editor and Terminal Container */}
          <div className="flex-1 flex flex-col">
            {/* Main Editor Area */}
            <div className={`transition-all duration-300 ${showTerminal ? `flex-1` : 'h-full'}`}>
              {/* Code Editor Area */}
              <div 
                className={`h-full w-full transition-all duration-300 relative`}
                onContextMenu={handleEditorContextMenu}
              >
                {selectedFile ? (
                  <>
                    {isImageFile(selectedFile.path) ? (
                      <div className="h-full flex items-center justify-center bg-gray-900 p-8 overflow-auto">
                        <div className="max-w-full max-h-full">
                          <img 
                            src={`data:image/${selectedFile.path.split('.').pop()};base64,${btoa(editorContent)}`}
                            alt={selectedFile.name}
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => {
                              // If base64 fails, try as direct URL or show error
                              console.error('Failed to load image');
                            }}
                          />
                          <div className="text-center mt-4 text-gray-400 text-sm">
                            <p>{selectedFile.name}</p>
                            <p className="text-xs text-gray-500 mt-1">Image files cannot be edited</p>
                          </div>
                        </div>
                      </div>
                    ) : isPdfFile(selectedFile.path) ? (
                      <div className="h-full flex flex-col bg-gray-900">
                        <div className="flex-1 overflow-hidden">
                          <iframe
                            src={`data:application/pdf;base64,${btoa(editorContent)}`}
                            className="w-full h-full border-0"
                            title={selectedFile.name}
                          />
                        </div>
                        <div className="text-center py-2 bg-gray-800 text-gray-400 text-xs border-t border-gray-700">
                          <p>{selectedFile.name} - PDF files cannot be edited</p>
                        </div>
                      </div>
                    ) : (
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
                    )}
                  </>
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
                      <EmbeddedTerminal isVisible={showTerminal} />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Chat Panel - Always at top level */}
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
              {/* Chat Content - SidebarChat has its own header */}
              <div className="flex-1 overflow-hidden relative">
                {/* Close button overlay */}
                <button
                  onClick={() => setShowChat(false)}
                  className="absolute top-3 right-4 z-50 p-1.5 hover:bg-gray-700/50 rounded-md text-gray-400 hover:text-white transition-colors"
                  title="Close Chat"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
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

      {/* Editor Context Menu */}
      {editorContextMenu && selectedFile && (
        <div
          ref={editorContextMenuRef}
          className="fixed bg-gray-800 border border-gray-700 rounded-md shadow-lg py-1 z-50 min-w-[180px]"
          style={{
            left: `${editorContextMenu.x}px`,
            top: `${editorContextMenu.y}px`,
          }}
        >
          <button
            onClick={() => {
              if (selectedFile) {
                const newName = prompt('Enter new name:', selectedFile.name);
                if (newName && newName.trim()) {
                  handleFileRename(selectedFile.path, newName.trim());
                }
              }
              setEditorContextMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            Rename
          </button>
          <button
            onClick={() => {
              if (selectedFile && window.confirm(`Are you sure you want to delete ${selectedFile.name}?`)) {
                handleFileDelete(selectedFile.path);
              }
              setEditorContextMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            Delete
          </button>
          <div className="border-t border-gray-700 my-1"></div>
          <button
            onClick={async () => {
              if (selectedFile && editorContent) {
                await copyTextToClipboard(editorContent);
                toast.success('File content copied to clipboard');
              }
              setEditorContextMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            Copy Content
          </button>
          <button
            onClick={async () => {
              if (selectedFile) {
                await copyTextToClipboard(selectedFile.path);
                toast.success('File path copied to clipboard');
              }
              setEditorContextMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            Copy Path
          </button>
          <div className="border-t border-gray-700 my-1"></div>
          <button
            onClick={() => {
              if (selectedFile) {
                closeTab(selectedFile.path);
              }
              setEditorContextMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            Close File (Ctrl+W)
          </button>
        </div>
      )}
    </div>
  );
};

export default CodeEditor;
