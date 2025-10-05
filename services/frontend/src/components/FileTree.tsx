import React, { useState, useEffect, useRef } from 'react';
import { ChevronRightIcon, ChevronDownIcon, DocumentIcon, FolderIcon, PlusIcon, ArrowPathIcon, CodeBracketIcon } from '@heroicons/react/24/outline';

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileNode[];
  content?: string;
  language?: string;
}

interface FileTreeProps {
  files: FileNode[];
  selectedFile?: string;
  onFileSelect: (file: FileNode) => void;
  onFileCreate: (parentPath: string, name: string, type: 'file' | 'folder') => void;
  onFileDelete: (filePath: string) => void;
  onFileRename: (filePath: string, newName: string) => void;
  // Repository/Branch props
  repos?: any[];
  branches?: string[];
  selectedRepo?: string;
  selectedBranch?: string;
  repoError?: string | null;
  branchError?: string | null;
  reposLoading?: boolean;
  branchesLoading?: boolean;
  onRepoChange?: (repo: string) => void;
  onBranchChange?: (branch: string) => void;
  onRefreshRepos?: () => void;
  onAddFileToChat?: (file: FileNode) => void;
  onCopyFile?: (file: FileNode) => void;
  onCutFile?: (file: FileNode) => void;
}

const FileTree: React.FC<FileTreeProps> = ({
  files,
  selectedFile,
  onFileSelect,
  onFileCreate,
  onFileDelete,
  onFileRename,
  repos = [],
  branches = [],
  selectedRepo = '',
  selectedBranch = '',
  repoError = null,
  branchError = null,
  reposLoading = false,
  branchesLoading = false,
  onRepoChange,
  onBranchChange,
  onRefreshRepos,
  onAddFileToChat,
  onCopyFile,
  onCutFile,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/']));
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileNode } | null>(null);
  const [pendingNewNodePath, setPendingNewNodePath] = useState<string | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  
  // Search states for repo and branch
  const [repoSearchTerm, setRepoSearchTerm] = useState('');
  const [branchSearchTerm, setBranchSearchTerm] = useState('');
  const [showRepoDropdown, setShowRepoDropdown] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const repoDropdownRef = useRef<HTMLDivElement | null>(null);
  const branchDropdownRef = useRef<HTMLDivElement | null>(null);

  const extensionBadgeMap: Record<string, { label: string; bg: string; text: string }> = {
    ts: { label: 'TS', bg: 'bg-blue-500/20 border-blue-400/60', text: 'text-blue-200' },
    tsx: { label: 'TSX', bg: 'bg-indigo-500/20 border-indigo-400/60', text: 'text-indigo-200' },
    js: { label: 'JS', bg: 'bg-yellow-500/20 border-yellow-400/60', text: 'text-yellow-200' },
    jsx: { label: 'JSX', bg: 'bg-yellow-500/20 border-yellow-400/60', text: 'text-yellow-200' },
    json: { label: 'JSON', bg: 'bg-teal-500/20 border-teal-400/60', text: 'text-teal-200' },
    css: { label: 'CSS', bg: 'bg-sky-500/20 border-sky-400/60', text: 'text-sky-200' },
    scss: { label: 'SCSS', bg: 'bg-pink-500/20 border-pink-400/60', text: 'text-pink-200' },
    md: { label: 'MD', bg: 'bg-purple-500/20 border-purple-400/60', text: 'text-purple-200' },
    html: { label: 'HTML', bg: 'bg-orange-500/20 border-orange-400/60', text: 'text-orange-200' },
    py: { label: 'PY', bg: 'bg-blue-500/20 border-blue-400/60', text: 'text-blue-200' },
    sh: { label: 'SH', bg: 'bg-gray-500/20 border-gray-400/60', text: 'text-gray-200' },
    sql: { label: 'SQL', bg: 'bg-emerald-500/20 border-emerald-400/60', text: 'text-emerald-200' },
    yml: { label: 'YML', bg: 'bg-amber-500/20 border-amber-400/60', text: 'text-amber-200' },
    yaml: { label: 'YML', bg: 'bg-amber-500/20 border-amber-400/60', text: 'text-amber-200' },
    env: { label: 'ENV', bg: 'bg-lime-500/20 border-lime-400/60', text: 'text-lime-200' },
  };

  const renderFileBadge = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const badge = extensionBadgeMap[ext];

    if (!badge) {
      return (
        <div className="flex items-center justify-center border border-gray-600/60 bg-gray-700/40 text-gray-300 text-[10px] font-semibold uppercase rounded-sm px-1.5 py-0.5 leading-none mr-2 flex-shrink-0 min-w-[28px]">
          <span>{ext ? ext.slice(0, 3) : 'TXT'}</span>
        </div>
      );
    }

    return (
      <div className={`flex items-center justify-center border ${badge.bg} ${badge.text} text-[10px] font-semibold uppercase rounded-sm px-1.5 py-0.5 leading-none mr-2 flex-shrink-0 min-w-[28px]`}
      >
        <span>{badge.label}</span>
      </div>
    );
  };

  const toggleFolder = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const startEditing = (filePath: string, currentName: string) => {
    setEditingFile(filePath);
    setEditingName(currentName);
  };

  const finishEditing = () => {
    if (editingFile && editingName.trim()) {
      onFileRename(editingFile, editingName.trim());
    }
    setEditingFile(null);
    setEditingName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      finishEditing();
    } else if (e.key === 'Escape') {
      setEditingFile(null);
      setEditingName('');
    }
  };

  const closeContextMenu = () => setContextMenu(null);

  const normalizePath = (path: string | null | undefined) => {
    if (!path || path === '/') {
      return '';
    }
    const trimmed = path.trim();
    const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+/g, '/').replace(/\/+$/, '');
  };

  const buildChildPath = (parent: string, name: string) => {
    const sanitizedParent = normalizePath(parent);
    const sanitizedName = (name || '').trim().replace(/[\\/]+/g, '-');
    const effectiveName = sanitizedName.length > 0 ? sanitizedName : 'untitled';
    const combined = `${sanitizedParent ? `${sanitizedParent}/` : ''}${effectiveName}`;
    const normalized = combined.replace(/\/+/g, '/');
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
  };

  const expandToPath = (path: string) => {
    const normalized = normalizePath(path);
    const next = new Set(expandedFolders);
    next.add('/');
    if (!normalized) {
      setExpandedFolders(next);
      return;
    }
    const segments = normalized.split('/').filter(Boolean);
    let current = '';
    segments.forEach(segment => {
      current += `/${segment}`;
      next.add(current);
    });
    setExpandedFolders(next);
  };

  const determineCreationParent = () => {
    if (!selectedFileNode) return '';
    if (selectedFileNode.type === 'folder') {
      return selectedFileNode.path;
    }
    const parentPath = selectedFileNode.path.split('/').slice(0, -1).join('/');
    return parentPath;
  };

  const triggerCreateItem = (type: 'file' | 'folder') => {
    const parentPath = determineCreationParent();
    const fallbackParent = parentPath && parentPath !== '' ? parentPath : '/';
    expandToPath(parentPath);

    const defaultName = type === 'file' ? 'untitled.ts' : 'untitled-folder';
    const newNodePath = buildChildPath(parentPath, defaultName);

    onFileCreate(fallbackParent, defaultName, type);

    if (type === 'folder') {
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        next.add(newNodePath);
        return next;
      });
    }

    setPendingNewNodePath(newNodePath);
  };

  // Filter repos and branches based on search
  const filteredRepos = repos.filter(r => 
    r.name.toLowerCase().includes(repoSearchTerm.toLowerCase()) ||
    r.fullName.toLowerCase().includes(repoSearchTerm.toLowerCase())
  );
  
  const filteredBranches = branches.filter(b => 
    b.toLowerCase().includes(branchSearchTerm.toLowerCase())
  );

  // Get display name for selected repo
  const getRepoDisplayName = () => {
    if (!selectedRepo) return 'Select repository';
    const repo = repos.find(r => r.fullName === selectedRepo);
    return repo ? repo.name : selectedRepo;
  };

  useEffect(() => {
    if (!contextMenu) return;

    const handleGlobalClick = (event: MouseEvent) => {
      if (contextMenuRef.current && contextMenuRef.current.contains(event.target as Node)) {
        return;
      }
      closeContextMenu();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeContextMenu();
      }
    };

    const handleScroll = () => closeContextMenu();

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('contextmenu', handleGlobalClick);
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('contextmenu', handleGlobalClick);
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [contextMenu]);

  // Handle clicks outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (repoDropdownRef.current && !repoDropdownRef.current.contains(event.target as Node)) {
        setShowRepoDropdown(false);
        setRepoSearchTerm('');
      }
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target as Node)) {
        setShowBranchDropdown(false);
        setBranchSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!pendingNewNodePath) return;
    const node = findFileNode(files, pendingNewNodePath);
    if (node) {
      setEditingFile(node.path);
      setEditingName(node.name);
      setPendingNewNodePath(null);
    }
  }, [files, pendingNewNodePath]);

  const handleContextMenu = (event: React.MouseEvent, node: FileNode) => {
    event.preventDefault();

    if (node.type === 'file') {
      onFileSelect(node);
    }

    const MENU_WIDTH = 200;
    const MENU_HEIGHT = 180;
    const adjustedX = Math.min(event.clientX, window.innerWidth - MENU_WIDTH);
    const adjustedY = Math.min(event.clientY, window.innerHeight - MENU_HEIGHT);

    setContextMenu({
      x: adjustedX,
      y: adjustedY,
      node,
    });
  };

  // Find the selected file node
  const findFileNode = (nodes: FileNode[], path: string): FileNode | null => {
    for (const node of nodes) {
      if (node.path === path) return node;
      if (node.children) {
        const found = findFileNode(node.children, path);
        if (found) return found;
      }
    }
    return null;
  };

  const selectedFileNode = selectedFile ? findFileNode(files, selectedFile) : null;

  // Get syntax highlighting class based on file extension
  const getSyntaxClass = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const syntaxMap: { [key: string]: string } = {
      'js': 'language-javascript',
      'jsx': 'language-javascript',
      'ts': 'language-typescript',
      'tsx': 'language-typescript',
      'py': 'language-python',
      'html': 'language-html',
      'css': 'language-css',
      'json': 'language-json',
      'md': 'language-markdown',
    };
    return syntaxMap[ext || ''] || 'language-plaintext';
  };

  const renderFileNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedFile === node.path;
    const isEditing = editingFile === node.path;

    return (
      <div key={node.id} className="select-none">
        <div
          className={`flex items-center py-1 px-2 hover:bg-gray-700 cursor-pointer group ${
            isSelected ? 'bg-blue-600' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onContextMenu={(event) => handleContextMenu(event, node)}
        >
          {node.type === 'folder' ? (
            <button
              onClick={() => toggleFolder(node.path)}
              className="mr-1 p-0.5 hover:bg-gray-600 rounded flex-shrink-0"
            >
              {isExpanded ? (
                <ChevronDownIcon className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRightIcon className="h-4 w-4 text-gray-400" />
              )}
            </button>
          ) : (
            <div className="w-5 mr-1 flex-shrink-0" />
          )}

          <div className="flex items-center flex-1 min-w-0">
            {node.type === 'folder' ? (
              <FolderIcon
                className={`h-4 w-4 mr-2 flex-shrink-0 transition-colors ${
                  isExpanded ? 'text-yellow-300' : 'text-yellow-500/70'
                }`}
              />
            ) : (
              renderFileBadge(node.name)
            )}

            {isEditing ? (
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={finishEditing}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-gray-800 text-white text-sm px-1 py-0.5 rounded border border-blue-500 focus:outline-none"
                autoFocus
              />
            ) : (
              <span
                className={`text-sm truncate ${
                  isSelected ? 'text-white' : 'text-gray-300'
                }`}
                onClick={() => node.type === 'file' && onFileSelect(node)}
                onDoubleClick={() => startEditing(node.path, node.name)}
              >
                {node.name}
              </span>
            )}
          </div>

        </div>

        {node.type === 'folder' && isExpanded && node.children && (
          <div>
            {node.children
              .slice()
              .sort((a, b) => {
                // Folders first, then files
                if (a.type === 'folder' && b.type === 'file') return -1;
                if (a.type === 'file' && b.type === 'folder') return 1;
                // Within same type, sort alphabetically
                return a.name.localeCompare(b.name);
              })
              .map((child) => renderFileNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full bg-gray-800 border-r border-gray-700 flex flex-col">
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex space-x-1">
            {onRefreshRepos && (
              <button
                onClick={onRefreshRepos}
                disabled={reposLoading}
                className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh repositories"
              >
                <ArrowPathIcon className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => triggerCreateItem('file')}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
              title="New file"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => triggerCreateItem('folder')}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
              title="New folder"
            >
              <FolderIcon className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`p-1 rounded ${showPreview ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
            title={showPreview ? "Hide preview" : "Show preview"}
          >
            <CodeBracketIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Repository and Branch side by side */}
        <div className="space-y-2">
          <div className="flex gap-2">
            {/* Repository Searchable Dropdown */}
            <div className="flex flex-col flex-1 relative" ref={repoDropdownRef}>
              <button
                className="bg-gray-700 text-sm text-white rounded px-2 py-1.5 focus:outline-none border border-gray-600 w-full text-left flex items-center justify-between"
                onClick={() => !reposLoading && setShowRepoDropdown(!showRepoDropdown)}
                disabled={reposLoading}
              >
                <span className="truncate">{reposLoading ? 'Loading…' : getRepoDisplayName()}</span>
                <svg className="h-4 w-4 flex-shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showRepoDropdown && !reposLoading && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 border border-gray-600 rounded shadow-lg z-50 max-h-64 overflow-hidden flex flex-col">
                  {/* Search Input */}
                  <div className="p-2 border-b border-gray-600">
                    <input
                      type="text"
                      placeholder="Search repositories..."
                      value={repoSearchTerm}
                      onChange={(e) => setRepoSearchTerm(e.target.value)}
                      className="w-full bg-gray-800 text-white text-xs px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
                      autoFocus
                    />
                  </div>
                  
                  {/* Dropdown List */}
                  <div className="overflow-y-auto max-h-48">
                    {filteredRepos.length === 0 ? (
                      <div className="px-2 py-2 text-xs text-gray-400">No repositories found</div>
                    ) : (
                      filteredRepos.map((r) => (
                        <button
                          key={r.id}
                          className={`w-full text-left px-2 py-1.5 text-xs hover:bg-gray-600 ${
                            selectedRepo === r.fullName ? 'bg-blue-600 text-white' : 'text-gray-200'
                          }`}
                          onClick={() => {
                            onRepoChange?.(r.fullName);
                            setShowRepoDropdown(false);
                            setRepoSearchTerm('');
                          }}
                        >
                          <div className="truncate">{r.name}</div>
                          {r.fullName !== r.name && (
                            <div className="text-[10px] text-gray-400 truncate">{r.fullName}</div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Branch Searchable Dropdown */}
            <div className="flex flex-col flex-1 relative" ref={branchDropdownRef}>
              <button
                className="bg-gray-700 text-sm text-white rounded px-2 py-1.5 focus:outline-none border border-gray-600 w-full text-left flex items-center justify-between"
                onClick={() => !branchesLoading && selectedRepo && setShowBranchDropdown(!showBranchDropdown)}
                disabled={!selectedRepo || branchesLoading}
              >
                <span className="truncate">
                  {branchesLoading
                    ? 'Loading…'
                    : selectedBranch || (branches.length ? 'Select branch' : branchError || 'No branches')}
                </span>
                <svg className="h-4 w-4 flex-shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showBranchDropdown && !branchesLoading && selectedRepo && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 border border-gray-600 rounded shadow-lg z-50 max-h-64 overflow-hidden flex flex-col">
                  {/* Search Input */}
                  <div className="p-2 border-b border-gray-600">
                    <input
                      type="text"
                      placeholder="Search branches..."
                      value={branchSearchTerm}
                      onChange={(e) => setBranchSearchTerm(e.target.value)}
                      className="w-full bg-gray-800 text-white text-xs px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
                      autoFocus
                    />
                  </div>
                  
                  {/* Dropdown List */}
                  <div className="overflow-y-auto max-h-48">
                    {filteredBranches.length === 0 ? (
                      <div className="px-2 py-2 text-xs text-gray-400">No branches found</div>
                    ) : (
                      filteredBranches.map((b) => (
                        <button
                          key={b}
                          className={`w-full text-left px-2 py-1.5 text-xs hover:bg-gray-600 truncate ${
                            selectedBranch === b ? 'bg-blue-600 text-white' : 'text-gray-200'
                          }`}
                          onClick={() => {
                            onBranchChange?.(b);
                            setShowBranchDropdown(false);
                            setBranchSearchTerm('');
                          }}
                        >
                          {b}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Error messages */}
          {(repoError || branchError) && (
            <div className="text-[10px] text-red-400">
              {repoError || branchError}
            </div>
          )}
        </div>
      </div>
      
      <div className={`overflow-y-auto ${showPreview && selectedFileNode?.type === 'file' ? 'flex-1' : 'h-full'}`}>
        {files.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            <div className="text-2xl mb-2">📁</div>
            <p className="text-sm">No files yet</p>
            <p className="text-xs">Create your first file to get started</p>
          </div>
        ) : (
          <div>
            {files
              .slice()
              .sort((a, b) => {
                // Folders first, then files
                if (a.type === 'folder' && b.type === 'file') return -1;
                if (a.type === 'file' && b.type === 'folder') return 1;
                // Within same type, sort alphabetically
                return a.name.localeCompare(b.name);
              })
              .map((file) => renderFileNode(file))}
          </div>
        )}
      </div>

      {/* Code Preview Panel */}
      {showPreview && selectedFileNode?.type === 'file' && (
        <div className="border-t border-gray-700 bg-gray-900 flex flex-col" style={{ height: '40%', minHeight: '200px' }}>
          {/* Preview Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <DocumentIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-xs font-medium text-gray-300 truncate" title={selectedFileNode.name}>
                {selectedFileNode.name}
              </span>
            </div>
            <button
              onClick={() => setShowPreview(false)}
              className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded flex-shrink-0"
              title="Close preview"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Preview Content */}
          <div className="flex-1 overflow-auto p-3">
            {selectedFileNode.content ? (
              <pre className="text-xs text-gray-300 font-mono leading-relaxed whitespace-pre-wrap break-words">
                <code className={getSyntaxClass(selectedFileNode.name)}>
                  {selectedFileNode.content}
                </code>
              </pre>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                <div className="text-center">
                  <DocumentIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No content to preview</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 w-48 bg-gray-800 border border-gray-700 rounded-md shadow-lg py-1"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
            onClick={() => {
              closeContextMenu();
              setTimeout(() => startEditing(contextMenu.node.path, contextMenu.node.name), 0);
            }}
          >
            Rename
          </button>
          <button
            className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
            onClick={() => {
              closeContextMenu();
              onFileDelete(contextMenu.node.path);
            }}
          >
            Delete
          </button>
          {contextMenu.node.type === 'file' && onAddFileToChat && (
            <button
              className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
              onClick={() => {
                closeContextMenu();
                onAddFileToChat(contextMenu.node);
              }}
            >
              Add file to chat
            </button>
          )}
          <button
            className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
            onClick={() => {
              closeContextMenu();
              if (onCopyFile) {
                onCopyFile(contextMenu.node);
              }
            }}
          >
            Copy
          </button>
          <button
            className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
            onClick={() => {
              closeContextMenu();
              if (onCutFile) {
                onCutFile(contextMenu.node);
              }
            }}
          >
            Cut
          </button>
        </div>
      )}
    </div>
  );
};

export default FileTree;
