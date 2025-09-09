import React, { useState } from 'react';
import { ChevronRightIcon, ChevronDownIcon, DocumentIcon, FolderIcon, PlusIcon } from '@heroicons/react/24/outline';

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
}

const FileTree: React.FC<FileTreeProps> = ({
  files,
  selectedFile,
  onFileSelect,
  onFileCreate,
  onFileDelete,
  onFileRename,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/']));
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      finishEditing();
    } else if (e.key === 'Escape') {
      setEditingFile(null);
      setEditingName('');
    }
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
          {node.type === 'folder' && (
            <button
              onClick={() => toggleFolder(node.path)}
              className="mr-1 p-0.5 hover:bg-gray-600 rounded"
            >
              {isExpanded ? (
                <ChevronDownIcon className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRightIcon className="h-4 w-4 text-gray-400" />
              )}
            </button>
          )}
          
          {node.type === 'folder' && !isExpanded && (
            <div className="w-4 mr-1" />
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
                onKeyPress={handleKeyPress}
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

          {/* Context menu for file operations */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 ml-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFileCreate(node.path, 'new-file', 'file');
              }}
              className="p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-white"
              title="New file"
            >
              <PlusIcon className="h-3 w-3" />
            </button>
            {node.type === 'folder' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFileCreate(node.path, 'new-folder', 'folder');
                }}
                className="p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-white"
                title="New folder"
              >
                <FolderIcon className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {node.type === 'folder' && isExpanded && node.children && (
          <div>
            {node.children.map((child) => renderFileNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full bg-gray-800 border-r border-gray-700">
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">Project Files</h3>
          <div className="flex space-x-1">
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
        </div>
      </div>
      
      <div className="overflow-y-auto h-full">
        {files.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            <div className="text-2xl mb-2">📁</div>
            <p className="text-sm">No files yet</p>
            <p className="text-xs">Create your first file to get started</p>
          </div>
        ) : (
          <div>
            {files.map((file) => renderFileNode(file))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileTree;
