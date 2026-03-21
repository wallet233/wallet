import { defineConfig } from '@prisma/config';
import path from 'path';

export default defineConfig({
  // ✅ Use absolute path to avoid "file not found"
  schema: path.join(__dirname, '../database/schema.prisma'),
});
