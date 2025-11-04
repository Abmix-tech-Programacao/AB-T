import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config.mjs";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // Estrutura simplificada: arquivos estáticos na raiz junto com index.js
  // Procurar por index.html na raiz do diretório atual (onde está o index.js)
  const rootPath = import.meta.dirname; // Diretório onde está o index.js
  
  // Verificar se existe index.html na raiz
  const indexHtmlPath = path.resolve(rootPath, "index.html");
  
  let staticPath = rootPath;
  
  if (!fs.existsSync(indexHtmlPath)) {
    // Fallback: tentar dist/public (estrutura antiga)
    const distPublicPath = path.resolve(rootPath, "public");
    const distPath = path.resolve(rootPath, "..", "dist", "public");
    
    if (fs.existsSync(path.resolve(distPublicPath, "index.html"))) {
      staticPath = distPublicPath;
      console.log(`[STATIC] Usando estrutura com pasta public: ${staticPath}`);
    } else if (fs.existsSync(path.resolve(distPath, "index.html"))) {
      staticPath = distPath;
      console.log(`[STATIC] Usando estrutura dist/public: ${staticPath}`);
    } else {
      throw new Error(
        `Could not find index.html. Tried: ${indexHtmlPath}, ${distPublicPath}, ${distPath}. Make sure to build and deploy correctly`,
      );
    }
  } else {
    console.log(`[STATIC] Usando estrutura na raiz: ${staticPath}`);
  }

  console.log(`[STATIC] Servindo arquivos estáticos de: ${staticPath}`);
  
  // Listar arquivos para debug
  if (fs.existsSync(staticPath)) {
    const files = fs.readdirSync(staticPath);
    console.log(`[STATIC] Arquivos encontrados:`, files.slice(0, 10)); // Mostrar apenas os primeiros 10
  }

  // Servir arquivos estáticos com configuração adequada
  app.use(express.static(staticPath, {
    // Configurar MIME types corretos
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      } else if (filePath.endsWith('.html')) {
        res.setHeader('Content-Type', 'text/html');
      }
    },
    // Não redirecionar para index.html automaticamente
    fallthrough: true,
    // Cache para assets
    maxAge: '1y' // Cache de 1 ano para todos os assets estáticos
  }));

  // Middleware específico para assets - garantir que não sejam redirecionados
  app.use('/assets/*', (req, res, next) => {
    const assetPath = path.resolve(staticPath, req.path.substring(1));
    console.log(`[STATIC] Tentando servir asset: ${assetPath}`);
    
    if (fs.existsSync(assetPath)) {
      // Definir MIME type correto baseado na extensão
      if (assetPath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (assetPath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      }
      res.sendFile(assetPath);
    } else {
      console.error(`[STATIC] Asset não encontrado: ${assetPath}`);
      res.status(404).send('Asset not found');
    }
  });

  // fall through to index.html APENAS para rotas que não são assets
  app.use("*", (req, res) => {
    // Não servir index.html para requisições de assets
    if (req.originalUrl.includes('/assets/')) {
      console.error(`[STATIC] Asset não encontrado: ${req.originalUrl}`);
      return res.status(404).send('Asset not found');
    }

    const indexPath = path.resolve(staticPath, "index.html");
    console.log(`[STATIC] Servindo index.html de: ${indexPath} para rota: ${req.originalUrl}`);
    
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      console.error(`[STATIC] index.html não encontrado em: ${indexPath}`);
      res.status(404).send('Application not properly built. Please run: npm run build');
    }
  });
}
