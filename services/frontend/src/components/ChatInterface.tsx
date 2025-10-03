import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useProjectStore } from '../stores/projectStore';
import { config } from '../config';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { 
  PaperClipIcon, 
  SparklesIcon, 
  Cog6ToothIcon,
  ChevronDownIcon,
  XMarkIcon,
  DocumentIcon,
  PhotoIcon,
  CodeBracketIcon
} from '@heroicons/react/24/outline';
import 'highlight.js/styles/github-dark.css';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  files?: FileAction[];
}

interface FileAction {
  type: 'create' | 'update' | 'delete';
  path: string;
  content?: string;
  language?: string;
}

interface Attachment {
  id: string;
  name: string;
  type: 'file' | 'image' | 'code';
  content?: string;
  size?: number;
  url?: string;
}

interface ChatSettings {
  provider: 'openai' | 'anthropic' | 'google' | 'auto' | 'openrouter' | 'ollama' | 'lmstudio' | 'azure';
  model: string;
  temperature: number;
  maxTokens: number;
  enhancePrompt: boolean;
  includeContext: boolean;
}

const ChatInterface: React.FC = () => {
  const { token } = useAuthStore();
  const { currentProject, getProjectStructure, createFile, updateFile } = useProjectStore();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [chatSettings, setChatSettings] = useState<ChatSettings>({
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000,
    enhancePrompt: true,
    includeContext: true,
  });

  const providerModels = {
    openai: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Latest multimodal model' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Faster and cheaper' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'High performance' },
      { id: 'gpt-4', name: 'GPT-4', description: 'Most capable model' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and efficient' },
    ],
    anthropic: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Latest and most capable' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most powerful reasoning' },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', description: 'Balanced performance' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fast and efficient' },
    ],
    google: [
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Latest advanced model' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast and efficient' },
      { id: 'gemini-pro', name: 'Gemini Pro', description: 'Advanced reasoning' },
      { id: 'gemini-pro-vision', name: 'Gemini Pro Vision', description: 'Multimodal capabilities' },
    ],
    auto: [
      { id: 'auto-best', name: 'Auto Best', description: 'Automatically select best available model' },
      { id: 'auto-fast', name: 'Auto Fast', description: 'Automatically select fastest model' },
      { id: 'auto-cheap', name: 'Auto Cheap', description: 'Automatically select cheapest model' },
    ],
    openrouter: [
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Via OpenRouter' },
      { id: 'openai/gpt-4o', name: 'GPT-4o', description: 'Via OpenRouter' },
      { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', description: 'Via OpenRouter' },
      { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', description: 'Open source via OpenRouter' },
      { id: 'mistralai/mistral-7b-instruct', name: 'Mistral 7B', description: 'Efficient open source' },
    ],
    ollama: [
      { id: 'llama3.1:405b', name: 'Llama 3.1 405B', description: 'Local deployment' },
      { id: 'llama3.1:70b', name: 'Llama 3.1 70B', description: 'High performance local' },
      { id: 'llama3.1:8b', name: 'Llama 3.1 8B', description: 'Fast local model' },
      { id: 'mistral:7b', name: 'Mistral 7B', description: 'Efficient local model' },
      { id: 'codellama:13b', name: 'Code Llama 13B', description: 'Code-specialized local' },
      { id: 'deepseek-coder:6.7b', name: 'DeepSeek Coder 6.7B', description: 'Code-focused local' },
    ],
    lmstudio: [
      { id: 'local-model', name: 'Local Model', description: 'Your local LM Studio model' },
      { id: 'llama-3.1-70b', name: 'Llama 3.1 70B', description: 'Via LM Studio' },
      { id: 'mistral-7b', name: 'Mistral 7B', description: 'Via LM Studio' },
      { id: 'codellama-13b', name: 'Code Llama 13B', description: 'Via LM Studio' },
    ],
    azure: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Azure OpenAI GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Azure OpenAI GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Azure OpenAI GPT-4 Turbo' },
      { id: 'gpt-4', name: 'GPT-4', description: 'Azure OpenAI GPT-4' },
      { id: 'gpt-35-turbo', name: 'GPT-3.5 Turbo', description: 'Azure OpenAI GPT-3.5 Turbo' },
    ],
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const attachment: Attachment = {
          id: Date.now().toString() + Math.random(),
          name: file.name,
          type: file.type.startsWith('image/') ? 'image' : 
                file.name.endsWith('.js') || file.name.endsWith('.ts') || file.name.endsWith('.py') ? 'code' : 'file',
          content: content,
          size: file.size,
        };
        setAttachments(prev => [...prev, attachment]);
      };
      reader.readAsText(file);
    });
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const enhancePrompt = (originalPrompt: string): string => {
    if (!chatSettings.enhancePrompt) return originalPrompt;
    
    return `You are an expert AI coding assistant. Please help with the following request:

${originalPrompt}

Please provide:
1. Clear, well-commented code
2. Explanation of the approach
3. Best practices and considerations
4. Any potential improvements or alternatives

Context: ${chatSettings.includeContext ? 'Working on a project with the following structure:\n' + getProjectStructure() : 'No additional context provided.'}`;
  };

  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return;

    const enhancedMessage = enhancePrompt(message);
    const userMessage: Message = {
      id: Date.now().toString(),
      content: message,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setAttachments([]);
    setIsLoading(true);

    try {
      const response = await fetch(`${config.apiGatewayUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: enhancedMessage,
          originalMessage: userMessage.content,
          attachments: attachments,
          settings: chatSettings,
          context: {
            projectName: currentProject?.name || 'Untitled Project',
            projectStructure: getProjectStructure(),
            currentFiles: currentProject?.files || [],
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        role: 'assistant',
        timestamp: new Date(),
        files: data.files || [],
      };

      // Process file changes from AI response
      if (data.files && data.files.length > 0 && currentProject) {
        data.files.forEach((file: FileAction) => {
          try {
            if (file.type === 'create') {
              createFile('/', file.path, 'file', file.content);
            } else if (file.type === 'update') {
              updateFile(file.path, file.content || '');
            }
          } catch (error) {
            console.error(`Failed to process file ${file.path}:`, error);
            toast.error(`Failed to ${file.type} file: ${file.path}`);
          }
        });
      }

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Failed to send message. Please try again.');
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error. Please try again.',
        role: 'assistant',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderFileAction = (file: FileAction) => {
    return (
      <div key={file.path} className="mt-4 p-3 bg-gray-800 rounded-lg border border-gray-600">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-blue-400">
            {file.type === 'create' && '📄 Created'}
            {file.type === 'update' && '✏️ Updated'}
            {file.type === 'delete' && '🗑️ Deleted'}
          </span>
          <span className="text-xs text-gray-400">{file.path}</span>
        </div>
        {file.content && (
          <pre className="text-xs bg-gray-900 p-2 rounded overflow-x-auto">
            <code className={`language-${file.language || 'text'}`}>
              {file.content}
            </code>
          </pre>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Chat Header */}
      <div className="border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">AI Assistant</h2>
            <p className="text-sm text-gray-400">Chat with AI to build and modify your code</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 text-sm">
              <span className="text-gray-400">Provider:</span>
              <span className="text-blue-400 font-medium">
                {chatSettings.provider === 'auto' ? 'Auto (Smart Selection)' :
                 chatSettings.provider === 'openrouter' ? 'OpenRouter' :
                 chatSettings.provider === 'ollama' ? 'Ollama (Local)' :
                 chatSettings.provider === 'lmstudio' ? 'LM Studio (Local)' :
                 chatSettings.provider === 'azure' ? 'Azure OpenAI' :
                 chatSettings.provider.toUpperCase()} - {chatSettings.model}
              </span>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-gray-700 rounded-md text-gray-400 hover:text-white"
              title="Chat Settings"
            >
              <Cog6ToothIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-600">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">AI Provider</label>
                <select
                  value={chatSettings.provider}
                  onChange={(e) => setChatSettings(prev => ({ 
                    ...prev, 
                    provider: e.target.value as 'openai' | 'anthropic' | 'google' | 'auto' | 'openrouter' | 'ollama' | 'lmstudio' | 'azure',
                    model: providerModels[e.target.value as keyof typeof providerModels][0].id
                  }))}
                  className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                  <option value="auto">Auto (Smart Selection)</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="ollama">Ollama (Local)</option>
                  <option value="lmstudio">LM Studio (Local)</option>
                  <option value="azure">Azure OpenAI</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Model</label>
                <select
                  value={chatSettings.model}
                  onChange={(e) => setChatSettings(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {providerModels[chatSettings.provider].map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} - {model.description}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Temperature: {chatSettings.temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={chatSettings.temperature}
                  onChange={(e) => setChatSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Focused</span>
                  <span>Creative</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Max Tokens: {chatSettings.maxTokens}
                </label>
                <input
                  type="range"
                  min="100"
                  max="4000"
                  step="100"
                  value={chatSettings.maxTokens}
                  onChange={(e) => setChatSettings(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              
              <div className="md:col-span-2 space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={chatSettings.enhancePrompt}
                    onChange={(e) => setChatSettings(prev => ({ ...prev, enhancePrompt: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-300">Enhance prompts for better results</span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={chatSettings.includeContext}
                    onChange={(e) => setChatSettings(prev => ({ ...prev, includeContext: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-300">Include project context</span>
                </label>
              </div>
              
              {/* Provider-specific information */}
              <div className="md:col-span-2">
                <div className="bg-gray-700 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-gray-200 mb-2">Provider Info</h4>
                  {chatSettings.provider === 'auto' && (
                    <p className="text-xs text-gray-400">
                      Automatically selects the best available model based on your request type and current load.
                    </p>
                  )}
                  {chatSettings.provider === 'openrouter' && (
                    <p className="text-xs text-gray-400">
                      Access multiple AI providers through OpenRouter. Requires OpenRouter API key.
                    </p>
                  )}
                  {chatSettings.provider === 'ollama' && (
                    <p className="text-xs text-gray-400">
                      Run models locally with Ollama. Ensure Ollama is running on your system.
                    </p>
                  )}
                  {chatSettings.provider === 'lmstudio' && (
                    <p className="text-xs text-gray-400">
                      Use local models via LM Studio. Make sure LM Studio is running and accessible.
                    </p>
                  )}
                  {chatSettings.provider === 'azure' && (
                    <p className="text-xs text-gray-400">
                      Use Azure OpenAI services. Requires Azure OpenAI deployment configuration.
                    </p>
                  )}
                  {['openai', 'anthropic', 'google'].includes(chatSettings.provider) && (
                    <p className="text-xs text-gray-400">
                      Direct API access to {chatSettings.provider.charAt(0).toUpperCase() + chatSettings.provider.slice(1)} services.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-8">
            <div className="text-4xl mb-4">🤖</div>
            <p className="text-lg mb-2">Welcome to AI Code Platform</p>
            <p className="text-sm">Start a conversation to build amazing applications with AI assistance</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-3xl ${msg.role === 'user' ? 'ml-12' : 'mr-12'}`}>
              <div className={`px-4 py-3 rounded-lg ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-white border border-gray-700'
              }`}>
                {msg.role === 'assistant' ? (
                  <div>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                      className="prose prose-invert prose-sm max-w-none"
                    >
              {msg.content}
                    </ReactMarkdown>
                    {msg.files && msg.files.length > 0 && (
                      <div className="mt-3">
                        {msg.files.map(renderFileAction)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                )}
              </div>
              <div className={`text-xs text-gray-500 mt-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                {msg.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 text-white border border-gray-700 px-4 py-3 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span>AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="border-t border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-300">Attachments</span>
            <button
              onClick={() => setAttachments([])}
              className="text-xs text-gray-400 hover:text-white"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center space-x-2 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2"
              >
                {attachment.type === 'image' ? (
                  <PhotoIcon className="h-4 w-4 text-green-400" />
                ) : attachment.type === 'code' ? (
                  <CodeBracketIcon className="h-4 w-4 text-blue-400" />
                ) : (
                  <DocumentIcon className="h-4 w-4 text-gray-400" />
                )}
                <span className="text-sm text-white truncate max-w-32">
                  {attachment.name}
                </span>
                <button
                  onClick={() => removeAttachment(attachment.id)}
                  className="text-gray-400 hover:text-red-400"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-700 p-4">
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask AI to help you build something amazing..."
              disabled={isLoading}
              className="w-full px-3 py-2 pr-12 border border-gray-600 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[40px] max-h-32"
              rows={1}
            />
            <div className="absolute right-2 top-2 flex space-x-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1 text-gray-400 hover:text-white"
                title="Attach files"
              >
                <PaperClipIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowAttachments(!showAttachments)}
                className="p-1 text-gray-400 hover:text-white"
                title="Enhance prompt"
              >
                <SparklesIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !message.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              'Send'
            )}
          </button>
        </div>
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileUpload}
          className="hidden"
          accept=".js,.ts,.jsx,.tsx,.py,.html,.css,.json,.md,.txt,.png,.jpg,.jpeg,.gif"
        />
        
        <div className="flex items-center justify-between mt-2">
          <div className="text-xs text-gray-500">
            Press Enter to send, Shift+Enter for new line
          </div>
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            <span>Attachments: {attachments.length}</span>
            <span>Enhanced: {chatSettings.enhancePrompt ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
