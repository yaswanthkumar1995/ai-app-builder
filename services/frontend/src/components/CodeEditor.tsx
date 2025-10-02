import React, { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { FolderIcon, ChatBubbleLeftRightIcon, XMarkIcon, CommandLineIcon } from '@heroicons/react/24/outline';
import FileTree from './FileTree';
import SidebarChat from './SidebarChat';
import EmbeddedTerminal from './EmbeddedTerminal';
import { useProjectStore, FileNode } from '../stores/projectStore';
import toast from 'react-hot-toast';

const CodeEditor: React.FC = () => {
  const {
    currentProject,
    selectedFile,
    selectFile,
    createFile,
    updateFile,
    deleteFile,
    renameFile,
  } = useProjectStore();

  const [editorContent, setEditorContent] = useState(selectedFile?.content || '');
  const [showFileTree, setShowFileTree] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(300);
  const editorRef = useRef<any>(null);
  const resizerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedFile) {
      setEditorContent(selectedFile.content || '');
    }
  }, [selectedFile]);

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
          />
        </div>
      )}

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Editor Header */}
        <div className="border-b border-gray-700 p-4 bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowFileTree(!showFileTree)}
                className="p-2 hover:bg-gray-700 rounded-md text-gray-400 hover:text-white"
                title="Toggle file tree"
              >
                <FolderIcon className="h-5 w-5" />
              </button>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {selectedFile ? selectedFile.name : 'No file selected'}
                </h2>
                <p className="text-sm text-gray-400">
                  {selectedFile ? selectedFile.path : 'Select a file to start editing'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={handleTerminalToggle}
                className={`flex items-center px-3 py-2 rounded-md focus:outline-none focus:ring-2 transition-colors ${
                  showTerminal 
                    ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500' 
                    : 'bg-gray-700 text-white hover:bg-gray-600 focus:ring-gray-500'
                }`}
                title={showTerminal ? "Hide Terminal (Ctrl+`)" : "Show Terminal (Ctrl+`)"}
              >
                <CommandLineIcon className="h-4 w-4 mr-2" />
                Terminal
              </button>
              <button
                onClick={handleChatToggle}
                className={`flex items-center px-3 py-2 rounded-md focus:outline-none focus:ring-2 transition-colors ${
                  showChat 
                    ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500' 
                    : 'bg-gray-700 text-white hover:bg-gray-600 focus:ring-gray-500'
                }`}
                title={showChat ? "Hide Chat (Ctrl+Shift+C)" : "Show Chat (Ctrl+Shift+C)"}
              >
                <ChatBubbleLeftRightIcon className="h-4 w-4 mr-2" />
                Chat
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
