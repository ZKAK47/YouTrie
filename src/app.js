import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import routes from './routes/index.js';
import { errorHandler } from './middleware/error.middleware.js';
import { sessionMiddleware } from './middleware/auth.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let publicServingFoler = "public"

if (process.env.NODE_ENV === "production")
  publicServingFoler = "dist"

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sessionMiddleware); // Your existing session logic

// API Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Static files
app.use(express.static(path.join(__dirname, publicServingFoler)));

// Error handling (should be last)
app.use(errorHandler);

export default app;