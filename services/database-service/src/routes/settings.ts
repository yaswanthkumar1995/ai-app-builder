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
    // First check if user is authenticated
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized - No user ID' });
    }

    const userId = req.user.id;
    console.log('Fetching settings for user ID:', userId);

    // Get provider settings with error handling
    let settings;
    try {
      settings = await db
        .select()
        .from(providerSettings)
        .where(eq(providerSettings.userId, userId));
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
    };

    // Populate provider settings with detailed logging
    settings.forEach(setting => {
      console.log('Processing setting:', setting.provider, setting.enabled);
      if (setting.provider === 'openai') {
        formattedSettings.openai = {
          apiKey: setting.apiKey || '',
          enabled: setting.enabled,
        };
      } else if (setting.provider === 'anthropic') {
        formattedSettings.anthropic = {
          apiKey: setting.apiKey || '',
          enabled: setting.enabled,
        };
      } else if (setting.provider === 'google') {
        formattedSettings.google = {
          apiKey: setting.apiKey || '',
          enabled: setting.enabled,
        };
      } else if (setting.provider === 'github') {
        formattedSettings.github = {
          apiKey: setting.apiKey || '',
          enabled: setting.enabled,
        };
      } else if (setting.provider === 'ollama') {
        formattedSettings.ollama = {
          baseUrl: setting.baseUrl || '',
          enabled: setting.enabled,
          customUrl: setting.customConfig ? (setting.customConfig as any).customUrl || false : false,
        };
      }
    });

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
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Save provider settings for user
router.post('/providers', async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;

    // Updated schema to match frontend
    const settingsSchema = z.object({
      openai: z.object({
        apiKey: z.string(),
        enabled: z.boolean(),
      }),
      anthropic: z.object({
        apiKey: z.string(),
        enabled: z.boolean(),
      }),
      google: z.object({
        apiKey: z.string(),
        enabled: z.boolean(),
      }),
      github: z.object({
        apiKey: z.string(),
        enabled: z.boolean(),
      }),
      ollama: z.object({
        baseUrl: z.string(),
        enabled: z.boolean(),
        customUrl: z.boolean(),
      }),
      preferences: z.object({
        darkMode: z.boolean(),
        autoSave: z.boolean(),
        theme: z.string(),
        notifications: z.boolean(),
        autoApprove: z.boolean(),
      }),
      workflow: z.object({
        maxChatTurns: z.number(),
        thinkingBudget: z.number(),
        autoFixProblems: z.boolean(),
      }),
    });

    const validatedSettings = settingsSchema.parse(req.body);

    // Combine preferences and workflow for storage
    const combinedPreferences = {
      ...validatedSettings.preferences,
      workflow: validatedSettings.workflow,
    };

    // Save all provider settings including new ones
    const providers = ['openai', 'anthropic', 'google', 'github', 'ollama'] as const;

    for (const provider of providers) {
      const providerData = validatedSettings[provider] as any; // Type assertion for mixed types
      let insertData: any = {
        userId,
        provider,
        enabled: providerData.enabled,
      };

      // Handle apiKey for all providers (ollama doesn't have it)
      if (provider !== 'ollama') {
        insertData.apiKey = providerData.apiKey;
      }

      // Handle special fields for certain providers
      if (provider === 'ollama') {
        insertData.baseUrl = providerData.baseUrl;
        insertData.customConfig = { customUrl: providerData.customUrl };
      }

      // Check if setting exists
      const existing = await db
        .select()
        .from(providerSettings)
        .where(and(
          eq(providerSettings.userId, userId),
          eq(providerSettings.provider, provider)
        ))
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        await db
          .update(providerSettings)
          .set({
            ...insertData,
            updatedAt: new Date(),
          })
          .where(eq(providerSettings.id, existing[0].id));
      } else {
        // Create new
        await db.insert(providerSettings).values(insertData);
      }
    }

    // Save user preferences
    const existingPrefs = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    if (existingPrefs.length > 0) {
      await db
        .update(userPreferences)
        .set({
          preferences: combinedPreferences,
          updatedAt: new Date(),
        })
        .where(eq(userPreferences.id, existingPrefs[0].id));
    } else {
      await db.insert(userPreferences).values({
        userId,
        preferences: combinedPreferences,
      });
    }

    res.json({ message: 'Settings saved successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid settings data', details: error.errors });
    }

    console.error('Error saving provider settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
