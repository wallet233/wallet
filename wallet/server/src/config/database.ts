import { PrismaClient } from '@prisma/client';

// Standard initialization. No arguments.
// The engine will pull DATABASE_URL from process.env automatically.
const prisma = new PrismaClient();

export default prisma;
