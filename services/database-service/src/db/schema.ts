import { mysqlTable, varchar, text, boolean, timestamp, json } from 'drizzle-orm/mysql-core';
import { createId } from '@paralleldrive/cuid2';

export const users = mysqlTable('users', {
  id: varchar('id', { length: 128 }).primaryKey().$defaultFn(() => createId()),
  username: varchar('username', { length: 50 }).notNull().unique(),
  firstname: varchar('firstname', { length: 100 }),
  lastname: varchar('lastname', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  password: text('password'),
  avatar: varchar('avatar', { length: 500 }),
  isVerified: boolean('is_verified').default(false).notNull(),
  verificationToken: varchar('verification_token', { length: 255 }),
  verificationExpires: timestamp('verification_expires'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const providerSettings = mysqlTable('provider_settings', {
  id: varchar('id', { length: 128 }).primaryKey().$defaultFn(() => createId()),
  userId: varchar('user_id', { length: 128 }).notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  openaiToken: text('openai_token'),
  openaiEnabled: boolean('openai_enabled').default(false).notNull(),
  anthropicToken: text('anthropic_token'),
  anthropicEnabled: boolean('anthropic_enabled').default(false).notNull(),
  googleToken: text('google_token'),
  googleEnabled: boolean('google_enabled').default(false).notNull(),
  githubToken: text('github_token'),
  githubEnabled: boolean('github_enabled').default(false).notNull(),
  githubInstallationId: varchar('github_installation_id', { length: 255 }),
  githubAppType: varchar('github_app_type', { length: 50 }),
  githubSetupAction: varchar('github_setup_action', { length: 50 }),
  ollamaBaseUrl: varchar('ollama_base_url', { length: 255 }).default('http://localhost:11434'),
  ollamaEnabled: boolean('ollama_enabled').default(false).notNull(),
  ollamaCustomUrl: boolean('ollama_custom_url').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userPreferences = mysqlTable('user_preferences', {
  id: varchar('id', { length: 128 }).primaryKey().$defaultFn(() => createId()),
  userId: varchar('user_id', { length: 128 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  preferences: json('preferences').$type<{
    darkMode: boolean;
    autoSave: boolean;
    theme: string;
    notifications: boolean;
    autoApprove: boolean;
  }>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const projects = mysqlTable('projects', {
  id: varchar('id', { length: 128 }).primaryKey().$defaultFn(() => createId()),
  userId: varchar('user_id', { length: 128 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  githubRepo: varchar('github_repo', { length: 500 }), // GitHub repository URL
  githubBranch: varchar('github_branch', { length: 100 }).default('main'), // GitHub branch
  isGithubProject: boolean('is_github_project').default(false).notNull(),
  files: json('files').$type<Array<{
    name: string;
    path: string;
    content: string;
    language: string;
  }>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const terminalSessions = mysqlTable('terminal_sessions', {
  id: varchar('id', { length: 128 }).primaryKey().$defaultFn(() => createId()),
  userId: varchar('user_id', { length: 128 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: varchar('project_id', { length: 128 }).references(() => projects.id, { onDelete: 'cascade' }),
  sessionId: varchar('session_id', { length: 256 }).notNull().unique(),
  status: varchar('status', { length: 50 }).default('active').notNull(), // active, inactive, terminated
  workingDirectory: varchar('working_directory', { length: 500 }).default('/workspace'),
  environment: json('environment').$type<Record<string, string>>(), // Environment variables
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastAccessedAt: timestamp('last_accessed_at').defaultNow().notNull(),
});

export const chatSessions = mysqlTable('chat_sessions', {
  id: varchar('id', { length: 128 }).primaryKey().$defaultFn(() => createId()),
  userId: varchar('user_id', { length: 128 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: varchar('project_id', { length: 128 }).references(() => projects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }),
  messages: json('messages').$type<Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
