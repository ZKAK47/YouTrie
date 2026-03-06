import crypto from 'crypto';
import { oauthStore } from '../database/oauth-store.js';

export const sessionMiddleware = (req, res, next) => {
  let sessionId = req.cookies.sessionId;

  if (!sessionId) {
    sessionId = crypto.randomBytes(16).toString('hex');
    res.cookie('sessionId', sessionId, { 
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax'
    });
  }
  
  req.sessionId = sessionId;
  next();
};

export const validateSession = async (req, res, next) => {
  const cookieSessionId = req.sessionId;
  
  console.log('🔒 Validating session:', cookieSessionId);

  // 1️⃣ Récupérer le userId associé à ce cookie
  const userObject = await oauthStore.getUser({cookie:cookieSessionId})
  const userId = userObject.userId;
  
  if (!userId) {
    console.log('❌ No userId found for cookie:', cookieSessionId);
    return res.status(401).json({
      error: 'Not authenticated',
      redirect: '/api/auth'
    });
  }

  // 2️⃣ Récupérer le client avec ce userId
  const client = userObject.oauth2Client;
  
  if (!client) {
    console.log('❌ No client found for userId:', userId);
    return res.status(401).json({
      error: 'Invalid session',
      redirect: '/api/auth'
    });
  }

  // 3️⃣ Vérifier que le client a des credentials
  if (!client.credentials?.access_token && !client.credentials?.refresh_token) {
    console.log('❌ Client has no credentials for userId:', userId);
    return res.status(401).json({
      error: 'Invalid credentials',
      redirect: '/api/auth'
    });
  }

  console.log('✅ Session valid:', { cookie: cookieSessionId, userId });
  
  // 4️⃣ Attacher le client à la requête
  req.userObject = userObject
  
  next();
};