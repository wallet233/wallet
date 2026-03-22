import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Express } from 'express';
import { logger } from '../utils/logger.js';
import { validator } from '../utils/validator.js';

type RouteModule = {
  routeConfig?: {
    path: string;
    router: any;
    isPublic?: boolean;
  };
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * my Dynamic Route Loader
 * Automatically discovers and mounts all .routes.ts files in the modules directory.
 */
export async function loadRoutes(app: Express) {
  const modulesPath = path.join(__dirname, '../modules');
  
  if (!fs.existsSync(modulesPath)) {
    logger.error(`[RouteLoader] Modules directory not found at ${modulesPath}`);
    return;
  }

  const moduleFolders = fs.readdirSync(modulesPath);

  for (const folder of moduleFolders) {
    const fullFolderPath = path.join(modulesPath, folder);
    if (!fs.statSync(fullFolderPath).isDirectory()) continue;

    const files = fs.readdirSync(fullFolderPath);

    for (const file of files) {
      // Look for .routes.ts or .routes.js
      if (!file.match(/\.routes\.(ts|js)$/)) continue;
      
      const filePath = path.join(fullFolderPath, file);

      try {
        // Fix: Use pathToFileURL for cross-platform ESM compatibility
        const moduleUrl = pathToFileURL(filePath).href;
        const mod: RouteModule = await import(moduleUrl);

        if (mod.routeConfig) {
          const apiPath = `/api${mod.routeConfig.path}`;
          
          // API GUARDIAN: Apply global validation unless route is marked isPublic
          if (mod.routeConfig.isPublic) {
            app.use(apiPath, mod.routeConfig.router);
          } else {
            app.use(apiPath, validator.apiKeyAuth, mod.routeConfig.router);
          }

          logger.info(`[RouteLoader] Mounted: ${apiPath} ${mod.routeConfig.isPublic ? '(Public)' : '(Protected)'}`);
        }
      } catch (err: any) {
        logger.error(`[RouteLoader] Failed to load ${file}: ${err.message}`);
      }
    }
  }
}
