import crypto from 'crypto';
import { oauthStore } from '../database/oauth-store.js';

export const sessionMiddleware = (req, res, next) => {
  let sessionId = req.cookies.sessionId;

  // if there is no session create a new one
  if (!sessionId) {
    sessionId = crypto.randomBytes(16).toString('hex');
    res.cookie('sessionId', sessionId, { 
      maxAge: 24 * 60 * 60*90, // 24h in seconds 
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

  // get user infos matching the sessionId
  const userObject = await oauthStore.getUser({cookie:cookieSessionId})
  const userId = userObject?.userId;
  
  if (!userId) {
    return failedSessionValidationResponse("Not authenticated",res)
  }

  // get the Google Client
  const client = userObject.oauth2Client;
  
  if (!client) {
    return failedSessionValidationResponse("Invalid session",res)
  }

  // check the client's credentials
  if (!client.credentials?.access_token && !client.credentials?.refresh_token) {
    return failedSessionValidationResponse("Expired tokens",res)
  }
  
  // add the Google client to the request
  req.userObject = userObject
  
  next();
};

function failedSessionValidationResponse(ErrorMessage = "Not authenticated",res) {
  return res.status(401).json({
    error:ErrorMessage,
    redirect: '/api/auth'
  })
}