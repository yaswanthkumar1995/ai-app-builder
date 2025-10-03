import express from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { providerSettings, userPreferences } from '../db/schema';
import { z } from 'zod';

const router = express.Router();

// Extend Request interface to include user
interface AuthRequest extends express.Request {
  user?: { id: string; email: string };
}

// Get provider settings for user
router.get('/providers', async (req: AuthRequest, res) => {
  try {
    // First check if user is authenticated (JWT or x-user-id header)
    let userId: string | undefined = req.user?.id;
    if (!userId) {
      const headerUser = req.headers['x-user-id'];
      if (typeof headerUser === 'string' && headerUser.trim().length > 0) {
        userId = headerUser.trim();
        console.log('🔐 Using x-user-id header for GET /providers:', userId);
      }
    }
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - No user ID' });
    }

    console.log('Fetching settings for user ID:', userId);

        // Get provider settings with new schema
    let settings;
    try {
      settings = await db
        .select({
          id: providerSettings.id,
          userId: providerSettings.userId,
          openaiToken: providerSettings.openaiToken,
          openaiEnabled: providerSettings.openaiEnabled,
          anthropicToken: providerSettings.anthropicToken,
          anthropicEnabled: providerSettings.anthropicEnabled,
          googleToken: providerSettings.googleToken,
          googleEnabled: providerSettings.googleEnabled,
          githubToken: providerSettings.githubToken,
          githubEnabled: providerSettings.githubEnabled,
          githubInstallationId: providerSettings.githubInstallationId,
          githubAppType: providerSettings.githubAppType,
          githubSetupAction: providerSettings.githubSetupAction,
          ollamaBaseUrl: providerSettings.ollamaBaseUrl,
          ollamaEnabled: providerSettings.ollamaEnabled,
          ollamaCustomUrl: providerSettings.ollamaCustomUrl,
        })
        .from(providerSettings)
        .where(eq(providerSettings.userId, userId))
        .limit(1);
      console.log('Found provider settings:', settings.length);
    } catch (dbError) {
      console.error('Database error fetching provider settings:', dbError);
      return res.status(500).json({ error: 'Database error fetching provider settings' });
    }

    // Get user preferences with error handling
    let preferences;
    try {
      preferences = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);
      console.log('Found user preferences:', preferences.length);
    } catch (dbError) {
      console.error('Database error fetching user preferences:', dbError);
      return res.status(500).json({ error: 'Database error fetching user preferences' });
    }

    // Format response with all providers including new ones
    const formattedSettings = {
      openai: { apiKey: '', enabled: false },
      anthropic: { apiKey: '', enabled: false },
      google: { apiKey: '', enabled: false },
  github: { apiKey: '', enabled: false, installation_id: '', app_type: '', setup_action: '' },
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
    };

    // Populate provider settings with new schema
    if (settings.length > 0) {
      const setting = settings[0];
      console.log('Processing provider settings from new schema');
      
      formattedSettings.openai = {
        apiKey: setting.openaiToken || '',
        enabled: setting.openaiEnabled || false,
      };
      
      formattedSettings.anthropic = {
        apiKey: setting.anthropicToken || '',
        enabled: setting.anthropicEnabled || false,
      };
      
      formattedSettings.google = {
        apiKey: setting.googleToken || '',
        enabled: setting.googleEnabled || false,
      };
      
      formattedSettings.github = {
        apiKey: setting.githubToken || '',
        enabled: setting.githubEnabled || false,
        installation_id: setting.githubInstallationId || '',
        app_type: setting.githubAppType || '',
        setup_action: setting.githubSetupAction || '',
      };
      
      formattedSettings.ollama = {
        baseUrl: setting.ollamaBaseUrl || 'http://localhost:11434',
        enabled: setting.ollamaEnabled || false,
        customUrl: setting.ollamaCustomUrl || false,
      };
    }

    // Populate preferences
    if (preferences.length > 0) {
      const prefs = preferences[0].preferences as any;
      console.log('User preferences data:', prefs);
      formattedSettings.preferences = {
        darkMode: prefs.darkMode || false,
        autoSave: prefs.autoSave || true,
        theme: prefs.theme || 'system',
        notifications: prefs.notifications !== undefined ? prefs.notifications : true,
        autoApprove: prefs.autoApprove || false,
      };
      if (prefs.workflow) {
        formattedSettings.workflow = prefs.workflow;
        console.log('Workflow settings loaded:', prefs.workflow);
      }
    }

    console.log('Final formatted settings:', {
      hasOpenAI: formattedSettings.openai.enabled,
      hasAnthropic: formattedSettings.anthropic.enabled,
      hasGoogle: formattedSettings.google.enabled,
      hasGitHub: formattedSettings.github.enabled,
      hasOllama: formattedSettings.ollama.enabled,
    });

    res.json(formattedSettings);
  } catch (error) {
    console.error('Error in GET /providers:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Save provider settings for user
router.post('/providers', async (req: AuthRequest, res) => {
  console.log('🚀 POST /providers received with new schema');
  console.log('🚀 User from middleware:', req.user?.id);
  console.log('🚀 Request body:', JSON.stringify(req.body, null, 2));

  try {
    let effectiveUserId: string | undefined = req.user?.id;
    if (!effectiveUserId) {
      const headerUser = req.headers['x-user-id'];
      if (typeof headerUser === 'string' && headerUser.trim().length > 0) {
        effectiveUserId = headerUser.trim();
        console.log('🔐 Using x-user-id header as fallback for internal call:', effectiveUserId);
      }
    }
    if (!effectiveUserId) {
      console.log('❌ No user ID found (neither JWT nor x-user-id)');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = effectiveUserId;
    console.log('✅ Processing settings save for user:', userId);

    // Get existing settings for this user
    const existingSettings = await db
      .select({
        id: providerSettings.id,
        userId: providerSettings.userId,
      })
      .from(providerSettings)
      .where(eq(providerSettings.userId, userId))
      .limit(1);

    // Prepare update data
    const updateData: any = {
      userId,
      updatedAt: new Date(),
    };

    // Handle each provider specifically
    if (req.body.openai) {
      updateData.openaiToken = req.body.openai.apiKey || '';
      updateData.openaiEnabled = req.body.openai.enabled || false;
      console.log('� Setting OpenAI:', updateData.openaiEnabled ? 'enabled' : 'disabled');
    }

    if (req.body.anthropic) {
      updateData.anthropicToken = req.body.anthropic.apiKey || '';
      updateData.anthropicEnabled = req.body.anthropic.enabled || false;
      console.log('🔧 Setting Anthropic:', updateData.anthropicEnabled ? 'enabled' : 'disabled');
    }

    if (req.body.google) {
      updateData.googleToken = req.body.google.apiKey || '';
      updateData.googleEnabled = req.body.google.enabled || false;
      console.log('🔧 Setting Google:', updateData.googleEnabled ? 'enabled' : 'disabled');
    }

    if (req.body.github) {
      const githubBody = req.body.github;
      updateData.githubEnabled = githubBody.enabled || false;
      updateData.githubToken = githubBody.apiKey || '';
      updateData.githubInstallationId = githubBody.installation_id || null;
      updateData.githubAppType = githubBody.app_type || null;
      updateData.githubSetupAction = githubBody.setup_action || null;
      console.log('🔧 Setting GitHub:', updateData.githubEnabled ? 'enabled' : 'disabled');
      console.log('🔍 GitHub metadata set:', {
        hasToken: !!updateData.githubToken,
        installationId: updateData.githubInstallationId,
        appType: updateData.githubAppType,
        setupAction: updateData.githubSetupAction,
      });
    }

    if (req.body.ollama) {
      updateData.ollamaBaseUrl = req.body.ollama.baseUrl || 'http://localhost:11434';
      updateData.ollamaEnabled = req.body.ollama.enabled || false;
      updateData.ollamaCustomUrl = req.body.ollama.customUrl || false;
      console.log('🔧 Setting Ollama:', updateData.ollamaEnabled ? 'enabled' : 'disabled');
    }

    // Update or insert provider settings
    if (existingSettings.length > 0) {
      console.log('🔄 Updating existing provider settings...');
      await db
        .update(providerSettings)
        .set(updateData)
        .where(eq(providerSettings.id, existingSettings[0].id));
    } else {
      console.log('➕ Creating new provider settings...');
      await db.insert(providerSettings).values(updateData);
    }

    // Handle preferences if present
    if (req.body.preferences || req.body.workflow) {
      console.log('🔧 Processing preferences...');
      
      const existingPrefs = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      const combinedPreferences = {
        ...(req.body.preferences || {}),
        ...(req.body.workflow ? { workflow: req.body.workflow } : {}),
      };

      if (existingPrefs.length > 0) {
        const currentPrefs = (existingPrefs[0].preferences as any) || {};
        const mergedPrefs = { ...currentPrefs, ...combinedPreferences };
        
        await db
          .update(userPreferences)
          .set({
            preferences: mergedPrefs,
            updatedAt: new Date(),
          })
          .where(eq(userPreferences.id, existingPrefs[0].id));
      } else {
        const defaultPrefs = {
          darkMode: false,
          autoSave: true,
          theme: 'system',
          notifications: true,
          autoApprove: false,
          ...combinedPreferences
        };
        
        await db.insert(userPreferences).values({
          userId,
          preferences: defaultPrefs,
        });
      }
      
      console.log('✅ Preferences saved successfully');
    }

    console.log('✅ All settings saved successfully for user:', userId);
    
    // Immediately respond to prevent timeout/connection issues
    res.setHeader('Connection', 'close');
    res.status(200).json({ 
      message: 'Settings saved successfully',
      success: true,
      timestamp: new Date().toISOString()
    });
    
    // Force response to be sent immediately
    res.end();
    return;

  } catch (error) {
    console.error('❌ Error saving settings:', error);
    
    // Check if it's a database constraint error
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('Database error code:', (error as any).code);
      console.error('Database error message:', (error as any).message);
      
      if ((error as any).code === 'ER_DATA_TOO_LONG') {
        console.error('❌ Data too long for database field');
        return res.status(400).json({ error: 'API key is too long for database storage' });
      }
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
