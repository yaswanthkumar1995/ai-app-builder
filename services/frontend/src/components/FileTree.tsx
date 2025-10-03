import React, { useState } from 'react';
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
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/']));
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showPreview, setShowPreview] = useState(true);

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
              <FolderIcon className="h-4 w-4 text-blue-400 mr-2 flex-shrink-0" />
            ) : (
              <DocumentIcon className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
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
              onClick={() => onFileCreate('/', 'new-file', 'file')}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
              title="New file"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => onFileCreate('/', 'new-folder', 'folder')}
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
            {/* Repository */}
            <div className="flex flex-col flex-1">
              <select
                className="bg-gray-700 text-sm text-white rounded px-2 py-1.5 focus:outline-none border border-gray-600 w-full"
                value={selectedRepo}
                onChange={(e) => onRepoChange?.(e.target.value)}
                disabled={reposLoading}
              >
                <option value="">{reposLoading ? 'Loading…' : 'Repository'}</option>
                {repos.map((r) => (
                  <option key={r.id} value={r.fullName}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Branch */}
            <div className="flex flex-col flex-1">
              <select
                className="bg-gray-700 text-sm text-white rounded px-2 py-1.5 focus:outline-none border border-gray-600 w-full"
                value={selectedBranch}
                onChange={(e) => onBranchChange?.(e.target.value)}
                disabled={!selectedRepo || branchesLoading}
              >
                <option value="">
                  {branchesLoading
                    ? 'Loading…'
                    : branches.length
                      ? 'Branch'
                      : branchError || 'No branches'}
                </option>
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
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
    </div>
  );
};

export default FileTree;
