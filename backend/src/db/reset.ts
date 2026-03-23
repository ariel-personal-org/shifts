import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL required');

  const client = postgres(connectionString, { max: 1 });

  console.log('Dropping all tables...');
  await client`DROP SCHEMA public CASCADE`;
  await client`CREATE SCHEMA public`;
  console.log('Schema reset complete. Run db:migrate to recreate tables.');

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
