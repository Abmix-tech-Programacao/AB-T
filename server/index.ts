// Load environment variables FIRST - before any other imports
import { config } from "dotenv";
config();

import express, { type Request, Response, NextFunction } from "express";
import http from "http";
import type { ListenOptions } from "node:net";
import { WebSocketServer } from "ws";
import { setupTelephony } from "./telephony";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// Debug: verificar se as variáveis foram carregadas
console.log('[ENV] Debug das variáveis de ambiente:');
console.log(`[ENV] TWILIO_NUMBER: ${process.env.TWILIO_NUMBER ? `${process.env.TWILIO_NUMBER} ✅` : '❌ NÃO DEFINIDA'}`);
console.log(`[ENV] TWILIO_ACCOUNT_SID: ${process.env.TWILIO_ACCOUNT_SID ? `${process.env.TWILIO_ACCOUNT_SID.substring(0, 10)}... ✅` : '❌ NÃO DEFINIDA'}`);
console.log(`[ENV] ELEVENLABS_API_KEY: ${process.env.ELEVENLABS_API_KEY ? `${process.env.ELEVENLABS_API_KEY.substring(0, 10)}... ✅` : '❌ NÃO DEFINIDA'}`);

const app = express();

// Configure trust proxy for subpath deployment
app.set('trust proxy', true);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Create HTTP server
  const server = http.createServer(app);
  
  // Configura telefonia (WS /media, TwiML e rotas relacionadas)
  setupTelephony(app, server);
  
  await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Start server
  const port = parseInt(process.env.PORT || '5000', 10);
  const listenOptions: ListenOptions = {
    port,
    host: "0.0.0.0",
  };

  if (process.platform !== "win32") {
    // SO_REUSEPORT is unavailable on Windows; enabling it there throws ENOTSUP.
    listenOptions.reusePort = true;
  }

  server.listen(listenOptions, () => {
    log(`HTTP/WS on ${port}`);
  });
})();
