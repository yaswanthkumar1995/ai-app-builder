import React, { useState } from 'react';
import Editor from '@monaco-editor/react';

const SimpleCodeEditor: React.FC = () => {
  const [code, setCode] = useState(`// Welcome to AI Code Platform
// Start coding with AI assistance

import React from 'react';

function App() {
  return (
    <div className="app">
      <h1>Hello, World!</h1>
      <p>Start building amazing applications with AI assistance.</p>
    </div>
  );
}

export default App;`);

  return (
    <div className="flex h-full bg-gray-900">
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Editor Header */}
        <div className="border-b border-gray-700 p-4 bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Code Editor</h2>
              <p className="text-sm text-gray-400">Edit your code with AI-powered assistance</p>
            </div>
            
            <div className="flex items-center space-x-2">
              <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500">
                Run Code
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                AI Assist
              </button>
            </div>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1">
          <Editor
            height="100%"
            language="javascript"
            value={code}
            onChange={(value) => setCode(value || '')}
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
          />
        </div>
      </div>
    </div>
  );
};

export default SimpleCodeEditor;
