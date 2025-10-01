import { mysqlTable, varchar, text, boolean, timestamp, json } from 'drizzle-orm/mysql-core';
import { createId } from '@paralleldrive/cuid2';

export const users = mysqlTable('users', {
  id: varchar('id', { length: 128 }).primaryKey().$defaultFn(() => createId()),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  avatar: varchar('avatar', { length: 500 }),
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
  files: json('files').$type<Array<{
    name: string;
    path: string;
    content: string;
    language: string;
  }>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
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
