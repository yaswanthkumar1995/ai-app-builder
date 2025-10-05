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
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import 'highlight.js/styles/github-dark.css';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface ChatSettings {
  provider: 'openai' | 'anthropic' | 'google' | 'auto' | 'openrouter' | 'ollama' | 'lmstudio' | 'azure';
  model: string;
  temperature: number;
  maxTokens: number;
}

interface SidebarChatProps {
  currentFile?: {
    name: string;
    path: string;
    content: string;
    language: string;
  };
}

const SidebarChat: React.FC<SidebarChatProps> = ({ currentFile }) => {
  const { token } = useAuthStore();
  const { currentProject } = useProjectStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [chatSettings, setChatSettings] = useState<ChatSettings>({
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000,
  });

  const providerModels = {
    openai: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    ],
    anthropic: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
    ],
    google: [
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
      { id: 'gemini-pro', name: 'Gemini Pro' },
    ],
    auto: [
      { id: 'auto-best', name: 'Auto Best' },
      { id: 'auto-fast', name: 'Auto Fast' },
    ],
    openrouter: [
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'openai/gpt-4o', name: 'GPT-4o' },
      { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5' },
      { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B' },
    ],
    ollama: [
      { id: 'llama3.1:405b', name: 'Llama 3.1 405B' },
      { id: 'llama3.1:70b', name: 'Llama 3.1 70B' },
      { id: 'llama3.1:8b', name: 'Llama 3.1 8B' },
      { id: 'llama3.2', name: 'Llama 3.2' },
      { id: 'mistral:7b', name: 'Mistral 7B' },
      { id: 'codellama:13b', name: 'Code Llama 13B' },
      { id: 'deepseek-coder:6.7b', name: 'DeepSeek Coder' },
    ],
    lmstudio: [
      { id: 'local-model', name: 'Local Model' },
      { id: 'llama-3.1-70b', name: 'Llama 3.1 70B' },
      { id: 'mistral-7b', name: 'Mistral 7B' },
    ],
    azure: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-4', name: 'GPT-4' },
    ],
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: message.trim(),
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setIsLoading(true);

    try {
      const response = await fetch(`${config.apiGatewayUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: message.trim(),
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          settings: chatSettings,
          projectContext: currentProject ? {
            name: currentProject.name,
            description: currentProject.description,
            files: currentProject.files,
          } : null,
          currentFile: currentFile ? {
            name: currentFile.name,
            path: currentFile.path,
            content: currentFile.content,
            language: currentFile.language,
          } : null,
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
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Failed to send message. Please try again.');
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

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  return (
    <div className="flex flex-col h-full bg-gray-800">
      {/* Compact Settings */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-400">
            {chatSettings.provider === 'auto' ? 'Auto' :
             chatSettings.provider === 'openrouter' ? 'OpenRouter' :
             chatSettings.provider === 'ollama' ? 'Ollama' :
             chatSettings.provider === 'lmstudio' ? 'LM Studio' :
             chatSettings.provider === 'azure' ? 'Azure' :
             chatSettings.provider.toUpperCase()} - {providerModels[chatSettings.provider].find((m: any) => m.id === chatSettings.model)?.name}
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title="Settings"
          >
            <Cog6ToothIcon className="h-4 w-4" />
          </button>
        </div>
        
        {showSettings && (
          <div className="space-y-3 p-3 bg-gray-700 rounded-lg">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Provider</label>
              <select
                value={chatSettings.provider}
                onChange={(e) => setChatSettings(prev => ({ 
                  ...prev, 
                  provider: e.target.value as any,
                  model: providerModels[e.target.value as keyof typeof providerModels][0].id
                }))}
                className="w-full px-2 py-1 text-xs border border-gray-600 bg-gray-600 text-white rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google</option>
                <option value="ollama">Ollama (Local)</option>
                <option value="openrouter">OpenRouter</option>
                <option value="lmstudio">LM Studio (Local)</option>
                <option value="azure">Azure OpenAI</option>
                <option value="auto">Auto</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Model</label>
              <select
                value={chatSettings.model}
                onChange={(e) => setChatSettings(prev => ({ ...prev, model: e.target.value }))}
                className="w-full px-2 py-1 text-xs border border-gray-600 bg-gray-600 text-white rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {providerModels[chatSettings.provider].map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <div className="text-3xl mb-2">🤖</div>
            <p className="text-sm">Start a conversation with AI</p>
            <p className="text-xs mt-1">Ask for help with your code</p>
            {currentFile && (
              <div className="mt-4 p-2 bg-gray-700 rounded-lg text-xs">
                <p className="text-blue-400">Current file: {currentFile.name}</p>
                <p className="text-gray-300">Language: {currentFile.language}</p>
              </div>
            )}
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-100'
                }`}
              >
                <div className="text-sm">
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                      components={{
                        code: ({ className, children, ...props }: any) => {
                          const match = /language-(\w+)/.exec(className || '');
                          const isInline = !props.node || props.node.children.length === 1;
                          return !isInline && match ? (
                            <pre className="bg-gray-900 p-2 rounded text-xs overflow-x-auto my-2">
                              <code className={className} {...props}>
                                {children}
                              </code>
                            </pre>
                          ) : (
                            <code className="bg-gray-600 px-1 py-0.5 rounded text-xs" {...props}>
                              {children}
                            </code>
                          );
                        },
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
                <div className="text-xs opacity-70 mt-1">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 rounded-lg p-3 max-w-[85%]">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span className="text-sm text-gray-300">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {currentFile && (
        <div className="border-t border-gray-700 p-2">
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setMessage(`Can you help me understand this ${currentFile.language} code in ${currentFile.name}?`)}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Explain Code
            </button>
            <button
              onClick={() => setMessage(`Can you review this ${currentFile.language} code and suggest improvements?`)}
              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Code Review
            </button>
            <button
              onClick={() => setMessage(`Can you help me debug any issues in this ${currentFile.language} code?`)}
              className="px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
            >
              Debug Help
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-700 p-3">
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask AI for help..."
              disabled={isLoading}
              className="w-full px-3 py-2 pr-8 border border-gray-600 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
              rows={1}
              style={{ minHeight: '36px', maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !message.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              'Send'
            )}
          </button>
        </div>
        
        <div className="text-xs text-gray-500 mt-1 text-center">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
};

export default SidebarChat;