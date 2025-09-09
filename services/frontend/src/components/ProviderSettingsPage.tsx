import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { config } from '../config';
import toast from 'react-hot-toast';

interface ProviderData {
  id: string;
  name: string;
  models: string[];
  apiKey: string;
  enabled: boolean;
}

const ProviderSettingsPage: React.FC = () => {
  const { providerId } = useParams<{ providerId: string }>();
  const navigate = useNavigate();
  const { token } = useAuthStore();

  const [provider, setProvider] = useState<ProviderData | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (providerId) {
      fetchProviderSettings();
    }
  }, [providerId]);

  const fetchProviderSettings = async () => {
    if (!token || !providerId) return;

    setLoading(true);
    try {
      const response = await fetch(`${config.apiGatewayUrl}/api/settings/providers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();

        // Get provider-specific data
        const providerData = data[providerId];
        if (providerData) {
          setApiKey(providerData.apiKey || '');
          setEnabled(providerData.enabled || false);
        }

        // Set provider info
        const providerInfo: ProviderData = {
          id: providerId,
          name: getProviderName(providerId),
          models: getProviderModels(providerId),
          apiKey: providerData?.apiKey || '',
          enabled: providerData?.enabled || false,
        };
        setProvider(providerInfo);
      }
    } catch (error) {
      console.error('Failed to fetch provider settings:', error);
      toast.error('Failed to load provider settings');
    } finally {
      setLoading(false);
    }
  };

  const getProviderName = (id: string): string => {
    const names: Record<string, string> = {
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      google: 'Google AI',
    };
    return names[id] || 'Unknown Provider';
  };

  const getProviderModels = (id: string): string[] => {
    const models: Record<string, string[]> = {
      openai: ['GPT-4', 'GPT-3.5 Turbo'],
      anthropic: ['Claude 3 Opus', 'Claude 3 Sonnet', 'Claude 2'],
      google: ['Gemini Pro', 'PaLM 2'],
    };
    return models[id] || [];
  };

  const saveSettings = async () => {
    if (!token || !providerId) return;

    setSaving(true);
    try {
      const settings = {
        openai: providerId === 'openai' ? { apiKey, enabled } : { apiKey: '', enabled: false },
        anthropic: providerId === 'anthropic' ? { apiKey, enabled } : { apiKey: '', enabled: false },
        google: providerId === 'google' ? { apiKey, enabled } : { apiKey: '', enabled: false },
        preferences: {
          darkMode: false,
          autoSave: true,
        },
      };

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
        navigate('/settings');
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

  const deleteApiKey = async () => {
    if (!token || !providerId) return;

    setSaving(true);
    try {
      const settings = {
        openai: providerId === 'openai' ? { apiKey: '', enabled: false } : { apiKey: '', enabled: false },
        anthropic: providerId === 'anthropic' ? { apiKey: '', enabled: false } : { apiKey: '', enabled: false },
        google: providerId === 'google' ? { apiKey: '', enabled: false } : { apiKey: '', enabled: false },
        preferences: {
          darkMode: false,
          autoSave: true,
        },
      };

      const response = await fetch(`${config.apiGatewayUrl}/api/settings/providers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setApiKey('');
        setEnabled(false);
        toast.success('API key deleted successfully!');
      } else {
        throw new Error('Failed to delete API key');
      }
    } catch (error) {
      toast.error('Failed to delete API key');
      console.error('Delete error:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen px-8 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-24 mb-4"></div>
            <div className="h-10 bg-gray-200 rounded w-1/2 mb-6"></div>
            <div className="h-40 bg-gray-200 rounded w-full"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="min-h-screen px-8 py-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2 mb-4 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border rounded-md"
          >
            ← Go Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Provider Not Found</h1>
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">The provider "{providerId}" could not be found.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-8 py-4">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center gap-2 mb-4 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border rounded-md"
        >
          ← Go Back
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{provider.name}</h1>
            <p className="text-gray-600 mt-1">Configure your {provider.name} API settings</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-medium px-3 py-1 rounded-full ${
                enabled && apiKey
                  ? 'text-green-700 bg-green-100'
                  : 'text-gray-500 bg-gray-100'
              }`}
            >
              {enabled && apiKey ? 'Ready' : 'Needs Setup'}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">API Configuration</h2>

          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="provider-enabled"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="provider-enabled" className="ml-2 text-sm text-gray-700">
                Enable {provider.name}
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={!enabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder={`Enter your ${provider.name} API key`}
              />
              <p className="text-xs text-gray-500 mt-1">
                Your API key is stored securely and used only for AI processing.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Models</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {provider.models.map((model) => (
              <div key={model} className="text-sm text-gray-600 py-1">
                • {model}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between">
          <button
            onClick={deleteApiKey}
            disabled={saving || !apiKey}
            className="px-4 py-2 text-red-600 border border-red-300 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete API Key
          </button>

          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
  );
};

export default ProviderSettingsPage;
