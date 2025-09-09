import { mysqlTable, varchar, text, timestamp, boolean } from 'drizzle-orm/mysql-core';
import { createId } from '@paralleldrive/cuid2';

export const users = mysqlTable('users', {
  id: varchar('id', { length: 128 }).primaryKey().$defaultFn(() => createId()),
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
