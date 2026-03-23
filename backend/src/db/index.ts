import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as schema from './schema';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

// For migrations/scripts, use a single connection
const migrationClient = postgres(connectionString, { max: 1 });

// For the app, use a pooled connection
const queryClient = postgres(connectionString);

export const db = drizzle(queryClient, { schema });
export const migrationDb = drizzle(migrationClient, { schema });

export type DB = typeof db;
