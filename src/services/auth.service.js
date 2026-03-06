import crypto from 'crypto';
import { oauthStore } from '../database/oauth-store.js';

class AuthService {
  async handleCallback(code, sessionId) {
    if (!sessionId) {
      throw new Error('No session ID provided');
    }

    // Get the temporary client
    const tempClient = await oauthStore.getUser({cookie:sessionId});
    
    if (!tempClient) {
      throw new Error('Session expired or invalid');
    }

    // Exchange code for tokens
    const { tokens } = await tempClient.getToken(code);
    tempClient.setCredentials(tokens);

    // Generate permanent user ID
    const userId = `user_${crypto.randomBytes(8).toString('hex')}`;
    
    // Store with permanent user ID
    oauthStore.insertUser({cookie:sessionId, userId, oauth2Client:tempClient});
    
    // Clean up temp entry
    oauthStore.userIdToYouTube.delete(`temp_${sessionId}`);

    // You could save tokens to database here
    // await db.saveUserTokens(userId, tokens);

    return {
      success: true,
      userId,
      sessionId,
      message: 'Authentication successful'
    };
  }
}

export const authService = new AuthService();