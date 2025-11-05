import express, { type Express } from "express";
import fs from "fs";
import path from "path";

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

  // Servir index.html para todas as rotas não-API (SPA fallback)
  app.get("*", (_req, res) => {
    const indexFile = path.resolve(staticPath, "index.html");
    if (fs.existsSync(indexFile)) {
      res.sendFile(indexFile);
    } else {
      res.status(404).send("Not found");
    }
  });
}
