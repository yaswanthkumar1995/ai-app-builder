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
  ChatBubbleLeftRightIcon
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

  // States for local models
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [lmstudioModels, setLmstudioModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [customModelInput, setCustomModelInput] = useState('');

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

  // Fetch Ollama models when provider is selected
  useEffect(() => {
    if (chatSettings.provider === 'ollama') {
      fetchOllamaModels();
    } else if (chatSettings.provider === 'lmstudio') {
      fetchLMStudioModels();
    }
  }, [chatSettings.provider]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchOllamaModels = async () => {
    setLoadingModels(true);
    try {
      // Try to fetch from user's Ollama settings
      const response = await fetch(`${config.apiGatewayUrl}/api/settings/providers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const ollamaBaseUrl = data.ollama?.baseUrl || 'http://localhost:11434';
        
        // Fetch available models from Ollama
        const modelsResponse = await fetch(`${ollamaBaseUrl}/api/tags`);
        if (modelsResponse.ok) {
          const modelsData = await modelsResponse.json();
          const modelNames = modelsData.models?.map((m: any) => m.name) || [];
          setOllamaModels(modelNames);
          
          // Set first model as default if available
          if (modelNames.length > 0 && !customModelInput) {
            setChatSettings(prev => ({ ...prev, model: modelNames[0] }));
          }
        }
      }
    } catch (error) {
      console.log('Could not fetch Ollama models:', error);
      setOllamaModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const fetchLMStudioModels = async () => {
    setLoadingModels(true);
    try {
      // Try to fetch from LM Studio API (default port 1234)
      const lmstudioUrl = 'http://localhost:1234';
      const modelsResponse = await fetch(`${lmstudioUrl}/v1/models`);
      
      if (modelsResponse.ok) {
        const modelsData = await modelsResponse.json();
        const modelNames = modelsData.data?.map((m: any) => m.id) || [];
        setLmstudioModels(modelNames);
        
        // Set first model as default if available
        if (modelNames.length > 0 && !customModelInput) {
          setChatSettings(prev => ({ ...prev, model: modelNames[0] }));
        }
      }
    } catch (error) {
      console.log('Could not fetch LM Studio models:', error);
      setLmstudioModels([]);
    } finally {
      setLoadingModels(false);
    }
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
    <div className="flex flex-col h-full bg-surface-light dark:bg-surface-dark transition-colors">
      {/* Header Only - AI Assistant */}
      <div className="px-5 py-3.5 border-b border-border-subtle dark:border-border-dark bg-surface-light dark:bg-surface-dark transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ChatBubbleLeftRightIcon className="h-5 w-5 text-ink-muted dark:text-ink-soft" />
            <h2 className="text-lg font-medium text-ink dark:text-ink-light">AI Assistant</h2>
          </div>
        </div>
      </div>



      {/* Settings Panel */}
      {showSettings && (
        <div className="px-6 py-4 border-b border-border-subtle dark:border-border-dark bg-surface-subtle dark:bg-surface-dark-elevated transition-colors">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink-muted dark:text-ink-soft mb-2">Provider</label>
              <select
                value={chatSettings.provider}
                onChange={(e) => setChatSettings(prev => ({ 
                  ...prev, 
                  provider: e.target.value as any,
                  model: providerModels[e.target.value as keyof typeof providerModels][0].id
                }))}
                className="w-full px-3 py-2 text-sm border border-border-subtle bg-surface-light text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 dark:border-border-dark dark:bg-surface-dark-muted dark:text-ink-light"
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
              <label className="block text-xs font-medium text-ink-muted dark:text-ink-soft mb-2">Model</label>
              {(chatSettings.provider === 'ollama' || chatSettings.provider === 'lmstudio') ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={chatSettings.model}
                    onChange={(e) => {
                      setCustomModelInput(e.target.value);
                      setChatSettings(prev => ({ ...prev, model: e.target.value }));
                    }}
                    placeholder={`Enter ${chatSettings.provider === 'ollama' ? 'Ollama' : 'LM Studio'} model name...`}
                    className="w-full px-3 py-2 text-sm border border-border-subtle bg-surface-light text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 dark:border-border-dark dark:bg-surface-dark-muted dark:text-ink-light"
                    list={`${chatSettings.provider}-models-list`}
                  />
                  {loadingModels && (
                    <div className="text-xs text-ink-muted dark:text-ink-soft">Loading models...</div>
                  )}
                  {(chatSettings.provider === 'ollama' ? ollamaModels : lmstudioModels).length > 0 && (
                    <datalist id={`${chatSettings.provider}-models-list`}>
                      {(chatSettings.provider === 'ollama' ? ollamaModels : lmstudioModels).map((model) => (
                        <option key={model} value={model} />
                      ))}
                    </datalist>
                  )}
                  {!loadingModels && (chatSettings.provider === 'ollama' ? ollamaModels : lmstudioModels).length > 0 && (
                    <div className="text-xs text-ink-muted dark:text-ink-soft">
                      Available: {(chatSettings.provider === 'ollama' ? ollamaModels : lmstudioModels).join(', ')}
                    </div>
                  )}
                  {!loadingModels && (chatSettings.provider === 'ollama' ? ollamaModels : lmstudioModels).length === 0 && (
                    <div className="text-xs text-warning-400">
                      ⚠️ No models detected. Make sure {chatSettings.provider === 'ollama' ? 'Ollama' : 'LM Studio'} is running.
                    </div>
                  )}
                </div>
              ) : (
                <select
                  value={chatSettings.model}
                  onChange={(e) => setChatSettings(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-border-subtle bg-surface-light text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 dark:border-border-dark dark:bg-surface-dark-muted dark:text-ink-light"
                >
                  {providerModels[chatSettings.provider].map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-8 bg-surface-light dark:bg-surface-dark transition-colors">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="mb-8">
              <div className="text-7xl mb-6">🤖</div>
              <h3 className="text-xl font-medium text-ink dark:text-ink-light mb-2">
                Start a conversation with AI
              </h3>
              <p className="text-sm text-ink-muted dark:text-ink-soft">
                Ask for help with your code
              </p>
            </div>
            

          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 break-words overflow-hidden ${
                    msg.role === 'user'
                      ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30'
                      : 'bg-surface-subtle dark:bg-surface-dark-muted text-ink dark:text-ink-light border border-border-subtle/60 dark:border-border-dark/60 backdrop-blur'
                  }`}
                >
                  <div className="text-sm leading-relaxed break-words overflow-wrap-anywhere">
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                        components={{
                          code: ({ className, children, ...props }: any) => {
                            const match = /language-(\w+)/.exec(className || '');
                            const isInline = !props.node || props.node.children.length === 1;
                            return !isInline && match ? (
                              <pre className="bg-background-dark text-ink-light dark:bg-background-dark-deep p-3 rounded-lg text-xs overflow-x-auto my-3">
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              </pre>
                            ) : (
                              <code className="bg-primary-700/40 text-ink-light px-1.5 py-0.5 rounded text-xs break-all" {...props}>
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      <span className="break-words overflow-wrap-anywhere">{msg.content}</span>
                    )}
                  </div>
                  <div className="text-xs opacity-60 mt-2">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-surface-subtle dark:bg-surface-dark-muted border border-border-subtle/60 dark:border-border-dark/60 rounded-xl px-4 py-3 max-w-[85%] break-words overflow-hidden">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-400"></div>
                    <span className="text-sm text-ink-muted dark:text-ink-soft">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Section */}
      <div className="border-t border-border-subtle dark:border-border-dark px-4 py-4 bg-surface-light dark:bg-surface-dark transition-colors">
        {/* Provider and Model Selectors - Above Input */}
        <div className="flex items-center gap-3 mb-3">
          {/* Provider Dropdown */}
          <div className="relative">
            <select
              value={chatSettings.provider}
              onChange={(e) => setChatSettings(prev => ({ 
                ...prev, 
                provider: e.target.value as any,
                model: providerModels[e.target.value as keyof typeof providerModels]?.[0]?.id || 'gpt-4'
              }))}
              className="appearance-none bg-surface-subtle dark:bg-surface-dark-muted hover:bg-surface-muted/70 dark:hover:bg-surface-dark-elevated/80 text-ink dark:text-ink-light px-3 py-2 pr-8 rounded-lg cursor-pointer transition-colors focus:outline-none focus:ring-0 text-xs font-medium min-w-[100px] border border-border-subtle dark:border-border-dark"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google</option>
              <option value="ollama">Ollama</option>
              <option value="openrouter">OpenRouter</option>
              <option value="lmstudio">LM Studio</option>
              <option value="azure">Azure</option>
              <option value="auto">Auto</option>
            </select>
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none text-ink-muted dark:text-ink-soft">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          
          {/* Model Dropdown */}
          <div className="relative">
            {(chatSettings.provider === 'ollama' || chatSettings.provider === 'lmstudio') ? (
              <input
                type="text"
                value={chatSettings.model}
                onChange={(e) => {
                  setCustomModelInput(e.target.value);
                  setChatSettings(prev => ({ ...prev, model: e.target.value }));
                }}
                placeholder="Model name"
                className="bg-surface-subtle dark:bg-surface-dark-muted hover:bg-surface-muted/70 dark:hover:bg-surface-dark-elevated/80 text-ink dark:text-ink-light px-3 py-2 rounded-lg focus:outline-none focus:ring-0 placeholder:text-ink-muted dark:placeholder:text-ink-soft text-xs font-medium min-w-[100px] border border-border-subtle dark:border-border-dark"
                list={`${chatSettings.provider}-models-list`}
              />
            ) : (
              <>
                <select
                  value={chatSettings.model}
                  onChange={(e) => setChatSettings(prev => ({ ...prev, model: e.target.value }))}
                  className="appearance-none bg-surface-subtle dark:bg-surface-dark-muted hover:bg-surface-muted/70 dark:hover:bg-surface-dark-elevated/80 text-ink dark:text-ink-light px-3 py-2 pr-8 rounded-lg cursor-pointer transition-colors focus:outline-none focus:ring-0 text-xs font-medium min-w-[100px] border border-border-subtle dark:border-border-dark"
                >
                  {providerModels[chatSettings.provider].map((model: any) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none text-ink-muted dark:text-ink-soft">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="i need"
              disabled={isLoading}
              className="w-full px-4 py-3 border border-border-subtle dark:border-border-dark bg-surface-subtle dark:bg-surface-dark-muted text-ink dark:text-ink-light rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent resize-none text-sm placeholder:text-ink-muted dark:placeholder:text-ink-soft"
              rows={1}
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !message.trim()}
            className="w-10 h-10 bg-primary-600 text-white rounded-lg hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-ink-light"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SidebarChat;