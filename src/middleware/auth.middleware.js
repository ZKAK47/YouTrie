import crypto from 'crypto';
import { oauthStore } from '../database/oauth-store.js';

export const sessionMiddleware = (req, res, next) => {
  let sessionId = req.cookies.sessionId;

  // if there is no session create a new one
  if (!sessionId) {
    sessionId = crypto.randomBytes(16).toString('hex');
    res.cookie('sessionId', sessionId, { 
      maxAge: 24 * 60 * 60, // 24h in seconds 
      httpOnly: true, // can't be accessed by client
      sameSite: 'lax' // sent for requests with our servers as endpoints
    });
  }
  
  // add the sessionId to the request
  req.sessionId = sessionId;
  next();
};

export const validateSession = async (req, res, next) => {
  const cookieSessionId = req.sessionId;
  
  console.log('🔒 Validating session:', cookieSessionId);

  // get user infos matching the sessionId
  const userObject = await oauthStore.getUser({cookie:cookieSessionId})
  const userId = userObject.userId;
  
  if (!userId) {
    console.log('❌ No userId found for cookie:', cookieSessionId);
    return failedSessionValidationResponse("Not authenticated")
  }

  // get the Google Client
  const client = userObject.oauth2Client;
  
  if (!client) {
    console.log('❌ No client found for userId:', userId);
    return failedSessionValidationResponse("Invalid session")
  }

  // check the client's credentials
  if (!client.credentials?.access_token && !client.credentials?.refresh_token) {
    console.log('❌ Client has no credentials for userId:', userId);
    return failedSessionValidationResponse("Expired tokens")
  }

  console.log('Session valid:', { cookie: cookieSessionId, userId });
  
  // add the Google client to the request
  req.userObject = userObject
  
  next();
};

function failedSessionValidationResponse(ErrorMessage = "Not authenticated") {
  return res.status(401).json({
    error:ErrorMessage,
    redirect: '/api/auth'
  })
}