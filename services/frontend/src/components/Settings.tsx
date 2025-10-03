import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { config } from '../config';
import toast from 'react-hot-toast';
import { useTheme } from '../hooks/useTheme';
import { logTokenInfo } from '../utils/tokenUtils';

interface ProviderSettings {
  openai: { apiKey: string; enabled: boolean };
  anthropic: { apiKey: string; enabled: boolean };
  google: { apiKey: string; enabled: boolean };
  github: {
    apiKey: string;
    enabled: boolean;
    installation_id?: string;
    app_type?: string;
    setup_action?: string;
    account_login?: string;
    account_name?: string;
  };
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
    github: {
      apiKey: '',
      enabled: false,
      installation_id: '',
      app_type: '',
      setup_action: '',
      account_login: '',
      account_name: '',
    },
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
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('general');
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [showGitHubManage, setShowGitHubManage] = useState(false);
  const isGitHubConnected = settings.github.enabled && Boolean(settings.github.apiKey);
  const githubAccountLabel = settings.github.account_login || settings.github.account_name || user?.name || 'your GitHub account';
  const githubOrgLabel = settings.github.account_name && settings.github.account_name !== githubAccountLabel
    ? settings.github.account_name
    : 'your personal repositories';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showGitHubManage) {
        const target = event.target as Element;
        if (!target.closest('.github-manage-dropdown')) {
          setShowGitHubManage(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showGitHubManage]);


  // Apply theme whenever it changes
  useTheme(settings.preferences.theme);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    if (!token) return;

    setLoading(true);
    
    const makeRequest = async (authToken: string) => {
      return await fetch(`${config.apiGatewayUrl}/api/settings/providers`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
    };

    try {
      let response = await makeRequest(token);

      // If token expired, try to refresh and retry
      if (response.status === 401) {
        console.log('🔄 Token expired while fetching settings, attempting refresh...');
        const { refreshToken } = useAuthStore.getState();
        
        try {
          await refreshToken();
          const newToken = useAuthStore.getState().token;
          
          if (newToken && newToken !== token) {
            console.log('✅ Token refreshed, retrying fetch...');
            response = await makeRequest(newToken);
          } else {
            throw new Error('Failed to refresh token');
          }
        } catch (refreshError) {
          console.error('❌ Token refresh failed during fetch:', refreshError);
          logout();
          return;
        }
      }

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

  // Handle save button click for each section
  const saveSettings = async (section: string) => {
    console.log('🎯 saveSettings called for section:', section);
    
    if (!token) {
      console.error('❌ No token available');
      toast.error('Authentication required. Please log in again.');
      return;
    }

    // Debug: Check token expiration
    const tokenInfo = logTokenInfo(token);
    if (tokenInfo.isExpired) {
      console.warn('⚠️ Token is expired, trying to refresh:', tokenInfo.timeLeft);
      try {
        const { refreshToken } = useAuthStore.getState();
        if (refreshToken) {
          console.log('🔄 Attempting token refresh before save...');
          await refreshToken();
          console.log('✅ Token refreshed successfully, continuing with save...');
        } else {
          console.error('❌ No refresh token available');
          toast.error('Your session has expired. Please log in again.');
          logout();
          return;
        }
      } catch (error) {
        console.error('❌ Token refresh failed:', error);
        toast.error('Your session has expired. Please log in again.');
        logout();
        return;
      }
    }
  
    if (savingSection !== null) {
      console.log('❌ Save already in progress for:', savingSection);
      toast.error('Another save is in progress, please wait');
      return;
    }
  
    console.log('✅ Starting save process for:', section);
    setSavingSection(section);

    const makeRequest = async (authToken: string) => {
      // Only send the section being saved to reduce payload size and conflicts
      let dataToSave: any = {};
      
      if (section === 'integrations') {
        dataToSave = {
          github: settings.github,
        };
      } else if (section === 'ai providers') {
        dataToSave = {
          openai: settings.openai,
          anthropic: settings.anthropic,
          google: settings.google,
          ollama: settings.ollama,
        };
      } else if (section === 'general') {
        dataToSave = {
          preferences: settings.preferences,
        };
      } else if (section === 'workflow') {
        dataToSave = {
          workflow: settings.workflow,
        };
      } else {
        // Fallback: send all data
        dataToSave = {
          openai: settings.openai,
          anthropic: settings.anthropic,
          google: settings.google,
          github: settings.github,
          ollama: settings.ollama,
          preferences: settings.preferences,
          workflow: settings.workflow
        };
      }
  
      console.log('🚀 Sending settings save request for section:', section);
      console.log('📤 Current settings state:', JSON.stringify(settings, null, 2));
      console.log('📤 Data being sent:', JSON.stringify(dataToSave, null, 2));
      console.log('🔗 API URL:', `${config.apiGatewayUrl}/api/settings/providers`);

      // Create abort controller for better timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch(`${config.apiGatewayUrl}/api/settings/providers`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dataToSave),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    };

    try {
      let response = await makeRequest(token);
      console.log('📨 Response received - Status:', response.status);
  
      // If token expired, try to refresh and retry
      if (response.status === 401) {
        console.log('🔄 Token expired, attempting refresh...');
        const { refreshToken } = useAuthStore.getState();
        
        try {
          await refreshToken();
          const newToken = useAuthStore.getState().token;
          
          if (newToken && newToken !== token) {
            console.log('✅ Token refreshed, retrying request...');
            response = await makeRequest(newToken);
            console.log('📨 Retry response - Status:', response.status);
          } else {
            throw new Error('Failed to refresh token');
          }
        } catch (refreshError) {
          console.error('❌ Token refresh failed:', refreshError);
          toast.error('Session expired. Please log in again.');
          setTokenError('Your session has expired. Please log in again to continue.');
          logout();
          return;
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error response:', errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }
  
      // Handle different response types
      let result;
      const contentType = response.headers.get('content-type');
      console.log('📋 Response content-type:', contentType);
      console.log('📋 Response status:', response.status);
      
      try {
        if (response.status === 204 || !contentType?.includes('application/json')) {
          result = { message: 'Settings saved successfully' };
        } else {
          const responseText = await response.text();
          console.log('📋 Raw response text:', responseText);
          
          if (responseText.trim()) {
            result = JSON.parse(responseText);
          } else {
            result = { message: 'Settings saved successfully' };
          }
        }
      } catch (parseError) {
        console.error('❌ Error parsing response:', parseError);
        result = { message: 'Settings saved successfully' };
      }
      
      console.log('✅ Save successful:', result);
      toast.success(`${section.charAt(0).toUpperCase() + section.slice(1)} settings saved successfully!`);
  
    } catch (error: any) {
      console.error('❌ Save error:', error);
      if (error.name === 'AbortError') {
        toast.error('Request timed out. Please try again.');
      } else if (error.message.includes('Failed to fetch')) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error(`Failed to save: ${error.message}`);
      }
    } finally {
      console.log('🏁 Cleaning up save state for:', section);
      setSavingSection(null);
    }
  };

  const handleConnectGitHub = async () => {
    try {
      setLoading(true);
      
      // First, try to reconnect if installation already exists
      try {
        const reconnectResponse = await fetch(`${config.apiGatewayUrl}/api/auth/github/reconnect`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (reconnectResponse.ok) {
          const result = await reconnectResponse.json();
          if (result.success) {
            // Successfully reconnected existing installation
            toast.success('GitHub reconnected successfully!');
            // Refresh settings to show new connection status
            await fetchSettings();
            setLoading(false);
            return;
          }
        }
        
        // If reconnect didn't work (404 = no existing installation), fall through to normal flow
        if (reconnectResponse.status !== 404) {
          const errorData = await reconnectResponse.json().catch(() => ({}));
          if (process.env.NODE_ENV !== 'production') {
            console.log('Reconnect failed, falling back to new installation flow:', errorData);
          }
        }
      } catch (reconnectError) {
        // Silently fall through to normal installation flow
        if (process.env.NODE_ENV !== 'production') {
          console.log('Reconnect attempt failed, using normal flow:', reconnectError);
        }
      }
      
      // Normal flow: redirect to GitHub authorization
      const timestamp = Date.now();
      const authUrl = `${config.apiGatewayUrl}/api/auth/github?token=${encodeURIComponent(token || '')}&t=${timestamp}`;
      
      // Open GitHub App installation in current tab
      window.location.href = authUrl;
      
    } catch (error) {
      console.error('GitHub App connection error:', error);
      toast.error('Failed to connect GitHub App. Please try again.');
      setLoading(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`${config.apiGatewayUrl}/api/auth/github/disconnect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // Update settings to reflect disconnection
        setSettings(prev => ({
          ...prev,
          github: { apiKey: '', enabled: false }
        }));
        toast.success('GitHub account disconnected successfully');
        setShowGitHubManage(false);
      } else {
        throw new Error('Failed to disconnect GitHub');
      }
    } catch (error) {
      console.error('GitHub disconnect error:', error);
      toast.error('Failed to disconnect GitHub. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const githubAuth = urlParams.get('github_auth');
    const error = urlParams.get('error');

    if (error) {
      toast.error(`GitHub OAuth error: ${error}`);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (githubAuth === 'success') {
      toast.success('GitHub connected successfully!');
      // Refresh settings to get the latest data
      fetchSettings();
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);



  const handleSaveClick = async (section: string) => {
    console.log('🔘 Save button clicked for section:', section);
    try {
      await saveSettings(section);
    } catch (error) {
      console.error('❌ Error in handleSaveClick:', error);
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
    <div className="flex h-full bg-white dark:bg-gray-900">
      {/* Settings Sidebar */}
      <div className="w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
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
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">General Settings</h2>
                
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Appearance</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Theme</label>
                      <div className="flex space-x-2">
                        {(['light', 'dark', 'system'] as const).map((theme) => (
                          <button
                            key={theme}
                            onClick={() => updatePreference('theme', theme)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                              settings.preferences.theme === theme
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 hover:text-gray-900 dark:hover:text-white'
                            }`}
                          >
                            {theme.charAt(0).toUpperCase() + theme.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Notifications</label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Receive notifications for important updates</p>
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

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Auto-save</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto-save projects</label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Automatically save your work as you type</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.preferences.autoSave}
                      onChange={(e) => updatePreference('autoSave', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>
                </div>

                {/* Save Button for General Settings */}
                <div className="flex justify-end">
                  <button
                    onClick={() => handleSaveClick('general')}
                    disabled={savingSection === 'general'}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingSection === 'general' ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </div>
                    ) : (
                      'Save'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Workflow Settings */}
          {activeSection === 'workflow' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Workflow Settings</h2>
                
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">AI Workflow</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto-approve changes</label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Automatically approve and run AI-generated code changes</p>
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
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto-fix problems</label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Automatically fix TypeScript errors and issues</p>
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

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Chat Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                      <p className="text-xs text-gray-500 dark:text-gray-400">Maximum number of conversation turns in a chat session</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                      <p className="text-xs text-gray-500 dark:text-gray-400">Maximum tokens for AI thinking and reasoning</p>
                    </div>
                  </div>
                </div>

                {/* Save Button for Workflow Settings */}
                <div className="flex justify-end">
                  <button
                    onClick={() => handleSaveClick('workflow')}
                    disabled={savingSection === 'workflow'}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingSection === 'workflow' ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </div>
                    ) : (
                      'Save'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AI Provider Settings */}
          {activeSection === 'ai' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">AI Provider Settings</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Configure your AI provider API keys. Keys are stored securely and used only for AI processing.
                </p>

                {/* OpenAI */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="openai-enabled"
                        checked={settings.openai.enabled}
                        onChange={(e) => updateProviderSetting('openai', 'enabled', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="openai-enabled" className="ml-2 text-lg font-medium text-gray-900 dark:text-white">
                        OpenAI
                      </label>
                    </div>
                  </div>
                  <div>
                    <input
                      type="password"
                      value={settings.openai.apiKey}
                      onChange={(e) => updateProviderSetting('openai', 'apiKey', e.target.value)}
                      disabled={!settings.openai.enabled}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="API Key"
                    />
                  </div>
                </div>

                {/* Anthropic */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="anthropic-enabled"
                        checked={settings.anthropic.enabled}
                        onChange={(e) => updateProviderSetting('anthropic', 'enabled', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="anthropic-enabled" className="ml-2 text-lg font-medium text-gray-900 dark:text-white">
                        Anthropic
                      </label>
                    </div>
                  </div>
                  <div>
                    <input
                      type="password"
                      value={settings.anthropic.apiKey}
                      onChange={(e) => updateProviderSetting('anthropic', 'apiKey', e.target.value)}
                      disabled={!settings.anthropic.enabled}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="API Key"
                    />
                  </div>
                </div>

                {/* Google */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="google-enabled"
                        checked={settings.google.enabled}
                        onChange={(e) => updateProviderSetting('google', 'enabled', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="google-enabled" className="ml-2 text-lg font-medium text-gray-900 dark:text-white">
                        Google AI
                      </label>
                    </div>
                  </div>
                  <div>
                    <input
                      type="password"
                      value={settings.google.apiKey}
                      onChange={(e) => updateProviderSetting('google', 'apiKey', e.target.value)}
                      disabled={!settings.google.enabled}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="API Key"
                    />
                  </div>
                </div>

                {/* Ollama */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="ollama-enabled"
                        checked={settings.ollama.enabled}
                        onChange={(e) => updateProviderSetting('ollama', 'enabled', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="ollama-enabled" className="ml-2 text-lg font-medium text-gray-900 dark:text-white">
                        Ollama
                      </label>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Local AI Models</span>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Use Custom URL</label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Connect to remote Ollama instance</p>
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
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Available Ollama Models
                      </label>
                      <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
                        Models are automatically detected when Ollama is running locally or when connected remotely via custom URL.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Save Button for AI Provider Settings */}
                <div className="flex justify-end">
                  <button
                    onClick={() => handleSaveClick('ai providers')}
                    disabled={savingSection === 'ai providers'}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingSection === 'ai providers' ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </div>
                    ) : (
                      'Save'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Integrations Settings */}
          {activeSection === 'integrations' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Integrations</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Connect with third-party services to enhance your development experience.
                </p>

                {/* GitHub Integration */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {/* GitHub Icon */}
                      <div className="flex-shrink-0">
                        <svg className="w-8 h-8 text-gray-900 dark:text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">GitHub</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {isGitHubConnected
                            ? `Connected as '${githubAccountLabel}' to repositories in GitHub organizations: ${githubOrgLabel}`
                            : 'Connect GitHub for Background Agents, Bugbot and enhanced codebase context'}
                        </p>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {settings.github.enabled && settings.github.apiKey ? (
                        /* Connected State */
                        <div className="relative github-manage-dropdown">
                          <button
                            onClick={() => setShowGitHubManage(!showGitHubManage)}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            Manage
                            <svg className="ml-2 -mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {showGitHubManage && (
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                              <div className="py-1">
                                <button
                                  onClick={handleDisconnectGitHub}
                                  className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600"
                                >
                                  <svg className="mr-3 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  Disconnect Account
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Not Connected State */
                        <button
                          onClick={handleConnectGitHub}
                          disabled={loading}
                          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="mr-2 -ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          {loading ? 'Connecting...' : 'Connect'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Account Settings */}
          {activeSection === 'account' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Account Settings</h2>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Profile Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name</label>
                      <input
                        type="text"
                        value={user?.name || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
                      <input
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-red-200 dark:border-red-700">
                  <h3 className="text-lg font-medium text-red-600 mb-4">Danger Zone</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Sign Out</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Sign out of your account on this device</p>
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


        </div>
      </div>
    </div>
  );
};

export default Settings;