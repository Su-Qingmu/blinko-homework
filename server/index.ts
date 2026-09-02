import express from 'express';
import cors from 'cors';
import path from 'path';
import zlib from 'zlib';
import fs from 'fs';
import authRoutes from './routerExpress/auth';
import { configureSession } from './routerExpress/auth/config';

// tRPC related imports
import { createContext } from './context';
import { appRouter } from './routerTrpc/_app';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { createOpenApiExpressMiddleware } from 'trpc-to-openapi';

// API documentation
// swagger-ui / swagger-jsdoc removed (no OpenAPI docs in simplified build)

// Express router imports
import openaiRouter from './routerExpress/openai';


// Vite integration
import ViteExpress from 'vite-express';

// Process error handling
process.on('uncaughtException', (error) => {
  console.error('uncaughtException:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('unhandledRejection:', reason);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

process.on('exit', (code) => {
  console.log(`process exit, code: ${code}`);
});

// Server configuration
const app = express();
const PORT = 1111;
const appRootDev = path.resolve(__dirname, '../app');
const appRootProd = path.resolve(__dirname, '../server');
let server: any = null;

if (process.env.NODE_ENV === 'production') {
  // Vite configuration
  ViteExpress.config({
    mode: 'production',
    inlineViteConfig: {
      //docker production dir /dist not development dir
      root: appRootProd,
      build: { outDir: "public" }
    }
  });
} else {
  ViteExpress.config({
    viteConfigFile: path.resolve(appRootDev, 'vite.config.ts'),
    inlineViteConfig: {
      root: appRootDev,
    }
  });
}

// Global error handler
const errorHandler = (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('express error:', err);
  res.status(500).json({
    error: {
      message: 'Internal Server Error',
      ...(process.env.NODE_ENV !== 'production' ? { details: err.message, stack: err.stack } : {})
    }
  });
};

/**
 * Setup all API routes for the application
 */
async function setupApiRoutes(app: express.Application) {
  // Authentication routes
  app.use('/api/auth', authRoutes);

  // tRPC endpoint with adapter for Express
  app.use('/api/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext: ({ req, res }) => {
        return createContext(req, res);
      },
      onError: ({ error }) => {
        console.error('tRPC error:', error);
      }
    })
  );

  // File handling endpoints
  // Helper function to serve vditor dependencies with gzip compression
  const serveVditorFile = (routePath: string, filePath: string) => {
    app.use(routePath, (req, res) => {
      const fullPath = path.resolve(__dirname, filePath);
      
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        res.status(404).send('File not found');
        return;
      }
      
      // Check if client accepts gzip encoding
      const acceptEncoding = req.headers['accept-encoding'] || '';
      const supportsGzip = acceptEncoding.includes('gzip');
      
      // Determine content type based on file extension
      const contentType = filePath.endsWith('.css') 
        ? 'text/css' 
        : filePath.endsWith('.js') 
        ? 'application/javascript'
        : 'application/octet-stream';
      
      res.set({
        'Cache-Control': 'public, max-age=604800, immutable',
        'Expires': new Date(Date.now() + 604800000).toUTCString(),
        'Content-Type': contentType
      });
      
      // CSS files should not be gzipped (they're already minified)
      // Only gzip JS files
      if (supportsGzip && !filePath.endsWith('.css')) {
        // Send gzip compressed version for JS files
        res.set('Content-Encoding', 'gzip');
        const readStream = fs.createReadStream(fullPath);
        const gzipStream = zlib.createGzip({ level: 6 });
        readStream.pipe(gzipStream).pipe(res);
      } else {
        // Send uncompressed version (for CSS or when gzip not supported)
        res.sendFile(fullPath);
      }
    });
  };

  // Special handling for lute.min.js with gzip compression
  serveVditorFile('/dist/js/lute/lute.min.js', './lute.min.js');
  
  app.use('/dist/js/icons/ant.js', (req, res) => {
    res.set({
      'Cache-Control': 'public, max-age=604800, immutable',
      'Expires': new Date(Date.now() + 604800000).toUTCString()
    });
    res.sendFile(path.resolve(__dirname, './lute.min.js'));
  });

  // Serve vditor dependencies from local files
  serveVditorFile('/dist/js/mathjax/tex-svg-full.js', './vditor/js/mathjax/tex-svg-full.js');
  serveVditorFile('/dist/js/graphviz/full.render.js', './vditor/js/graphviz/full.render.js');
  serveVditorFile('/dist/js/graphviz/viz.js', './vditor/js/graphviz/viz.js');
  serveVditorFile('/dist/js/mermaid/mermaid.min.js', './vditor/js/mermaid/mermaid.min.js');
  serveVditorFile('/dist/js/echarts/echarts.min.js', './vditor/js/echarts/echarts.min.js');
  serveVditorFile('/dist/js/flowchart.js/flowchart.min.js', './vditor/js/flowchart.js/flowchart.min.js');
  serveVditorFile('/dist/js/abcjs/abcjs_basic.min.js', './vditor/js/abcjs/abcjs_basic.min.js');
  serveVditorFile('/dist/js/highlight.js/highlight.min.js', './vditor/js/highlight.js/highlight.min.js');
  serveVditorFile('/dist/js/highlight.js/third-languages.js', './vditor/js/highlight.js/third-languages.js');
  serveVditorFile('/dist/js/highlight.js/styles/github.min.css', './vditor/js/highlight.js/styles/github.min.css');
  serveVditorFile('/dist/js/highlight.js/styles/github-dark.min.css', './vditor/js/highlight.js/styles/github-dark.min.css');
  serveVditorFile('/dist/js/plantuml/plantuml-encoder.min.js', './vditor/js/plantuml/plantuml-encoder.min.js');
  serveVditorFile('/dist/js/markmap/markmap.min.js', './vditor/js/markmap/markmap.min.js');
  serveVditorFile('/dist/js/smiles-drawer/smiles-drawer.min.js', './vditor/js/smiles-drawer/smiles-drawer.min.js');
  serveVditorFile('/dist/js/katex/katex.min.js', './vditor/js/katex/katex.min.js');
  serveVditorFile('/dist/js/katex/mhchem.min.js', './vditor/js/katex/mhchem.min.js');
  app.use('/v1', openaiRouter);

  // OpenAPI integration (kept for client compatibility; OpenAPI docs page removed)
  app.use('/api',
    // @ts-ignore
    createOpenApiExpressMiddleware({
      router: appRouter,
      createContext: ({ req, res }: { req: express.Request; res: express.Response }) => {
        return createContext(req, res);
      }
    })
  );
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
}

/**
 * Bootstrap the server
 * Sets up middleware, auth, API routes and starts the server
 */
async function bootstrap() {
  try {
    app.use(cors({
      origin: true,
      credentials: true
    }));

    if (process.env.TRUST_PROXY === '1') {
      app.set('trust proxy', 1);
    }

    const staticOptions = {
      maxAge: '7d',
      immutable: true,
      setHeaders: (res: express.Response, path: string) => {
        const ext = path.split('.').pop()?.toLowerCase();
        if (['png', 'webp', 'svg', 'json', 'ico', 'gif', 'mp4'].includes(ext || '')) {
          res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
          res.setHeader('Expires', new Date(Date.now() + 604800000).toUTCString());
        }
      }
    };

    const publicPath = path.resolve(appRootProd, 'public');
    app.use(express.static(publicPath, staticOptions));

    // Add body parsers for JSON and form data
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    await configureSession(app);

    // Setup API routes
    await setupApiRoutes(app);
    //@ts-ignore
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      errorHandler(err, req, res, next);
    });

    // Start or update server
    if (!server) {
      const server = app.listen(PORT, "0.0.0.0", () => {
        console.log(`🎉server start on port http://0.0.0.0:${PORT} - env: ${process.env.NODE_ENV || 'development'}`);
      });
      
      // Increase timeout for large file uploads (5 minutes)
      server.timeout = 5 * 60 * 1000;
      server.keepAliveTimeout = 5 * 60 * 1000;
      server.headersTimeout = 5 * 60 * 1000;
      
      ViteExpress.bind(app, server); // the server binds to all network interfaces
    } else {
      console.log(`API routes updated - env: ${process.env.NODE_ENV || 'development'}`);
    }
  } catch (err) {
    console.error('start server error:', err);
    try {
      // Attempt to start server even if route setup fails
      if (!server) {
        const server = app.listen(PORT, "0.0.0.0", () => {
          console.log(`🎉server start on port http://0.0.0.0:${PORT} - env: ${process.env.NODE_ENV || 'development'}`);
        });
        ViteExpress.bind(app, server); // the server binds to all network interfaces
      }
    } catch (startupError) {
      console.error('start server error:', startupError);
    }
  }
}

// Start the server
bootstrap(); 
