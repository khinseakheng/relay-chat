import { config } from 'dotenv';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { createDatabaseConfig } from './database.config';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '../../.env') });

export default new DataSource(
  createDatabaseConfig({
    migrations: [`${__dirname}/migrations/*{.ts,.js}`],
    synchronize: false,
  }),
);
