import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { config } from '../config';
import toast from 'react-hot-toast';

interface ProviderSettings {
  openai: { apiKey: string; enabled: boolean };
  anthropic: { apiKey: string; enabled: boolean };
  google: { apiKey: string; enabled: boolean };
  github: { apiKey: string; enabled: boolean };
  ollama: { baseUrl: string; enabled: boolean; customUrl: boolean };
  preferences: {
    darkMode: boolean;
    autoSave: boolean;
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
    autoApprove: boolean;
  };
  workflow: {
    maxChatTurns: number;
    thinkingBudget: number;
    autoFixProblems: boolean;
  };
}

const Settings: React.FC = () => {
  const { token, user, logout } = useAuthStore();
  const [settings, setSettings] = useState<ProviderSettings>({
    openai: { apiKey: '', enabled: false },
    anthropic: { apiKey: '', enabled: false },
    google: { apiKey: '', enabled: false },
    github: { apiKey: '', enabled: false },
    ollama: { baseUrl: '', enabled: true, customUrl: false },
    preferences: {
      darkMode: false,
      autoSave: true,
      theme: 'system',
      notifications: true,
      autoApprove: false,
    },
    workflow: {
      maxChatTurns: 10,
      thinkingBudget: 1000,
      autoFixProblems: false,
    },
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('general');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    if (!token) return;

    setLoading(true);
    try {
      const response = await fetch(`${config.apiGatewayUrl}/api/settings/providers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      } else {
        console.error('Failed to fetch settings:', response.status, response.statusText);
        // Keep default settings on error
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      // Keep default settings on error
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!token) return;

    setSaving(true);
    try {
      const response = await fetch(`${config.apiGatewayUrl}/api/settings/providers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success('Settings saved successfully!');
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      toast.error('Failed to save settings');
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateProviderSetting = (provider: keyof Omit<ProviderSettings, 'preferences'>, field: string, value: string | boolean) => {
    setSettings(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value,
      },
    }));
  };

  const updatePreference = (field: string, value: boolean | string) => {
    setSettings(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [field]: value,
      },
    }));
  };

  const updateWorkflowSetting = (field: string, value: boolean | number) => {
    setSettings(prev => ({
      ...prev,
      workflow: {
        ...prev.workflow,
        [field]: value,
      },
    }));
  };

  const settingsSections = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'workflow', label: 'Workflow', icon: '🔄' },
    { id: 'ai', label: 'AI Providers', icon: '🤖' },
    { id: 'integrations', label: 'Integrations', icon: '🔗' },
    { id: 'account', label: 'Account', icon: '👤' },
  ];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-900">
      {/* Settings Sidebar */}
      <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          <nav className="p-4 space-y-2">
            {settingsSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  activeSection === section.id
                    ? 'bg-blue-600 text-white border border-blue-500'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <span className="mr-3">{section.icon}</span>
                {section.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8">
          {/* General Settings */}
          {activeSection === 'general' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-6">General Settings</h2>
                
                <div className="bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-700">
                  <h3 className="text-lg font-medium text-white mb-4">Appearance</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Theme</label>
                      <div className="flex space-x-2">
                        {(['light', 'dark', 'system'] as const).map((theme) => (
                          <button
                            key={theme}
                            onClick={() => updatePreference('theme', theme)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                              settings.preferences.theme === theme
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                            }`}
                          >
                            {theme.charAt(0).toUpperCase() + theme.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-300">Notifications</label>
                        <p className="text-xs text-gray-400">Receive notifications for important updates</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.preferences.notifications}
                        onChange={(e) => updatePreference('notifications', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-700">
                  <h3 className="text-lg font-medium text-white mb-4">Auto-save</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-300">Auto-save projects</label>
                      <p className="text-xs text-gray-400">Automatically save your work as you type</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.preferences.autoSave}
                      onChange={(e) => updatePreference('autoSave', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Workflow Settings */}
          {activeSection === 'workflow' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-6">Workflow Settings</h2>
                
                <div className="bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-700">
                  <h3 className="text-lg font-medium text-white mb-4">AI Workflow</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-300">Auto-approve changes</label>
                        <p className="text-xs text-gray-400">Automatically approve and run AI-generated code changes</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.preferences.autoApprove}
                        onChange={(e) => updatePreference('autoApprove', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-300">Auto-fix problems</label>
                        <p className="text-xs text-gray-400">Automatically fix TypeScript errors and issues</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.workflow.autoFixProblems}
                        onChange={(e) => updateWorkflowSetting('autoFixProblems', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-700">
                  <h3 className="text-lg font-medium text-white mb-4">Chat Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Max Chat Turns: {settings.workflow.maxChatTurns}
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="50"
                        value={settings.workflow.maxChatTurns}
                        onChange={(e) => updateWorkflowSetting('maxChatTurns', parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <p className="text-xs text-gray-400">Maximum number of conversation turns in a chat session</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Thinking Budget: {settings.workflow.thinkingBudget}
                      </label>
                      <input
                        type="range"
                        min="100"
                        max="5000"
                        step="100"
                        value={settings.workflow.thinkingBudget}
                        onChange={(e) => updateWorkflowSetting('thinkingBudget', parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <p className="text-xs text-gray-400">Maximum tokens for AI thinking and reasoning</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Provider Settings */}
          {activeSection === 'ai' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-6">AI Provider Settings</h2>
                <p className="text-sm text-gray-400 mb-6">
                  Configure your AI provider API keys. Keys are stored securely and used only for AI processing.
                </p>

                {/* OpenAI */}
                <div className="bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-700 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="openai-enabled"
                        checked={settings.openai.enabled}
                        onChange={(e) => updateProviderSetting('openai', 'enabled', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="openai-enabled" className="ml-2 text-lg font-medium text-white">
                        OpenAI
                      </label>
                    </div>
                    <span className="text-sm text-gray-400">GPT-4, GPT-3.5</span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={settings.openai.apiKey}
                      onChange={(e) => updateProviderSetting('openai', 'apiKey', e.target.value)}
                      disabled={!settings.openai.enabled}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="sk-..."
                    />
                  </div>
                </div>

                {/* Anthropic */}
                <div className="bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-700 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="anthropic-enabled"
                        checked={settings.anthropic.enabled}
                        onChange={(e) => updateProviderSetting('anthropic', 'enabled', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="anthropic-enabled" className="ml-2 text-lg font-medium text-white">
                        Anthropic
                      </label>
                    </div>
                    <span className="text-sm text-gray-400">Claude 3, Claude 2</span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={settings.anthropic.apiKey}
                      onChange={(e) => updateProviderSetting('anthropic', 'apiKey', e.target.value)}
                      disabled={!settings.anthropic.enabled}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="sk-ant-..."
                    />
                  </div>
                </div>

                {/* Google */}
                <div className="bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-700 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="google-enabled"
                        checked={settings.google.enabled}
                        onChange={(e) => updateProviderSetting('google', 'enabled', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="google-enabled" className="ml-2 text-lg font-medium text-white">
                        Google AI
                      </label>
                    </div>
                    <span className="text-sm text-gray-400">Gemini, PaLM</span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={settings.google.apiKey}
                      onChange={(e) => updateProviderSetting('google', 'apiKey', e.target.value)}
                      disabled={!settings.google.enabled}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="AIza..."
                    />
                  </div>
                </div>

                {/* Ollama */}
                <div className="bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="ollama-enabled"
                        checked={settings.ollama.enabled}
                        onChange={(e) => updateProviderSetting('ollama', 'enabled', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="ollama-enabled" className="ml-2 text-lg font-medium text-white">
                        Ollama
                      </label>
                    </div>
                    <span className="text-sm text-gray-400">Local AI Models</span>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-300">Use Custom URL</label>
                        <p className="text-xs text-gray-400">Connect to remote Ollama instance</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.ollama.customUrl}
                        onChange={(e) => updateProviderSetting('ollama', 'customUrl', e.target.checked)}
                        disabled={!settings.ollama.enabled}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                      />
                    </div>

                    {settings.ollama.customUrl && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Ollama Base URL
                        </label>
                        <input
                          type="url"
                          value={settings.ollama.baseUrl}
                          onChange={(e) => updateProviderSetting('ollama', 'baseUrl', e.target.value)}
                          disabled={!settings.ollama.enabled || !settings.ollama.customUrl}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          placeholder="http://localhost:11434"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Available Ollama Models
                      </label>
                      <div className="text-xs text-gray-400 bg-gray-900 p-3 rounded-md">
                        Models are automatically detected when Ollama is running locally or when connected remotely via custom URL.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Integrations Settings */}
          {activeSection === 'integrations' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-6">Integrations</h2>
                <p className="text-sm text-gray-400 mb-6">
                  Connect with third-party services to enhance your development experience.
                </p>

                {/* GitHub Integration */}
                <div className="bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-700">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="github-enabled"
                        checked={settings.github.enabled}
                        onChange={(e) => updateProviderSetting('github', 'enabled', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="github-enabled" className="ml-2 text-lg font-medium text-white">
                        GitHub Integration
                      </label>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-gray-400">Repository Access & Code Examples</span>
                      <div className="flex items-center mt-1">
                        <span className="h-2 w-2 bg-green-500 rounded-full mr-2"></span>
                        <span className="text-xs text-gray-400">Available</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Personal Access Token
                      </label>
                      <input
                        type="password"
                        value={settings.github.apiKey}
                        onChange={(e) => updateProviderSetting('github', 'apiKey', e.target.value)}
                        disabled={!settings.github.enabled}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="ghp_xxxxxxxxxx"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                          Create a Personal Access Token
                        </a>
                        {' '}to access private repositories. Leave blank for public repositories only.
                      </p>
                    </div>

                    <div className="bg-gray-900 p-4 rounded-md">
                      <h4 className="text-sm font-medium text-gray-300 mb-2">What you can do with GitHub Integration:</h4>
                      <ul className="text-sm text-gray-400 space-y-1">
                        <li>• Access your GitHub repositories and profiles</li>
                        <li>• Browse and search code examples from GitHub</li>
                        <li>• Import code from repositories into your projects</li>
                        <li>• Get professional code patterns and templates</li>
                      </ul>
                    </div>

                    {settings.github.enabled && (
                      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-blue-800">GitHub Integration Enabled</h3>
                            <div className="mt-2 text-sm text-blue-700">
                              <p>You can now access GitHub repositories and code examples in your projects.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Account Settings */}
          {activeSection === 'account' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-6">Account Settings</h2>

                <div className="bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-700">
                  <h3 className="text-lg font-medium text-white mb-4">Profile Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                      <input
                        type="text"
                        value={user?.name || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                      <input
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-lg shadow-sm border border-red-200">
                  <h3 className="text-lg font-medium text-red-600 mb-4">Danger Zone</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-white">Sign Out</h4>
                        <p className="text-xs text-gray-400">Sign out of your account on this device</p>
                      </div>
                      <button
                        onClick={logout}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="mt-8 flex justify-end">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </div>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
