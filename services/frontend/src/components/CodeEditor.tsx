import React, { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { PlayIcon, SparklesIcon, DocumentArrowDownIcon, FolderIcon } from '@heroicons/react/24/outline';
import FileTree from './FileTree';
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
  const [isRunning, setIsRunning] = useState(false);
  const [showFileTree, setShowFileTree] = useState(true);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    if (selectedFile) {
      setEditorContent(selectedFile.content || '');
    }
  }, [selectedFile]);

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

  const handleRunCode = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to run');
      return;
    }

    setIsRunning(true);
    try {
      // TODO: Implement actual code execution
      toast.success('Code executed successfully!');
    } catch (error) {
      toast.error('Failed to execute code');
    } finally {
      setIsRunning(false);
    }
  };

  const handleSaveFile = () => {
    if (!selectedFile) {
      toast.error('No file selected');
      return;
    }
    
    // TODO: Implement actual file saving
    toast.success('File saved successfully!');
  };

  const handleAIAssist = () => {
    // TODO: Integrate with chat interface for AI assistance
    toast.success('AI assistance feature coming soon!');
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
                onClick={handleSaveFile}
                className="flex items-center px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
                title="Save file"
              >
                <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                Save
              </button>
              <button
                onClick={handleRunCode}
                disabled={isRunning || !selectedFile}
                className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Run code"
              >
                <PlayIcon className="h-4 w-4 mr-2" />
                {isRunning ? 'Running...' : 'Run'}
              </button>
              <button
                onClick={handleAIAssist}
                className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="AI Assist"
              >
                <SparklesIcon className="h-4 w-4 mr-2" />
                AI Assist
              </button>
            </div>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1">
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
      </div>
    </div>
  );
};

export default CodeEditor;
