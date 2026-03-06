import { google } from 'googleapis';
import { oauthStore } from '../database/oauth-store.js';
import { authService } from '../services/auth.service.js';
import { AppError } from '../utils/errors.js';
import { config } from '../config/constants.js';
import crypto from 'crypto';

export const authController = {
  initiate: (req, res) => {
    // Le cookie sessionId (ex: "c8888616b7cf1c174e32e81d1439d30c")
    const cookieSessionId = req.sessionId;
    
    // Générer un state OAuth (UUID)
    const oauthState = crypto.randomUUID();
    
    console.log('🔐 Initiate auth:', {
      cookieSessionId,  // "c8888616b7cf1c174e32e81d1439d30c"
      oauthState        // "61360d3e-017e-4d15-97bb-d6d85c7c941c"
    });

    const {oauth2Client} = oauthStore.insertTemporaryUser({cookie:cookieSessionId, userId:oauthState})
  
    // STOCKER LE CLIENT AVEC LE STATE (pas le cookie !)
  
    console.log('✅ Stockage temporaire:');
  
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'https://www.googleapis.com/auth/youtube'],
      state: oauthState,
      prompt: 'consent'
    });
  
    res.redirect(url);
  },

  callback: async (req, res) => {
    try {
      const { code, state: oauthState } = req.query;
      
      console.log('📞 Callback reçu:', { 
        oauthState,
        cookieSessionId: req.sessionId 
      });
  
      // 1️⃣ Récupérer le vrai cookie sessionId depuis le mapping
      const clientObject = await oauthStore.getTemporaryUser({userId:oauthState})
      const cookieSessionId = clientObject.cookie
      
      if (!cookieSessionId) {
        throw new Error('Session expirée - état OAuth inconnu');
      }
  
      const tempClient = clientObject.oauth2Client;
      
      if (!tempClient) {
        throw new Error('Client OAuth temporaire introuvable');
      }
  
      // 3️⃣ Échanger le code contre des tokens
      const { tokens } = await tempClient.getToken(code);
      console.log(tokens)
      const {refresh_token,access_token,id_token} = tokens
      tempClient.setCredentials(tokens);
  
      // 4️⃣ Générer un vrai userId permanent
      const permanentUserId = `user_${crypto.randomBytes(8).toString('hex')}`;
  
      // 5️⃣ STOCKER DÉFINITIVEMENT
      // - Associe le cookie au userId permanent
      oauthStore.removeUser({cookie:cookieSessionId, userId:oauthState, oauth2Client:tempClient})

      await oauthStore.insertUser({cookie:cookieSessionId, userId:permanentUserId, oauth2Client:tempClient, refresh_token, access_token, id_token})
  
      console.log('✅ Stockage permanent:', {
        cookie: cookieSessionId,
        userId: permanentUserId,
      });
  
      // 7️⃣ Répondre au frontend
      res.send(`
        <script>
          if (window.opener) {
            window.opener.postMessage({ 
              success: true,
              userId: "${permanentUserId}",
              message: "Authentication successful" 
            }, window.origin);
          }
          window.close();
        </script>
      `);
  
    } catch (error) {
      console.error('❌ Auth callback error:', error);
      res.status(500).send(`
        <script>
          if (window.opener) {
            window.opener.postMessage({ 
              success: false, 
              error: "${error.message}" 
            }, window.origin);
          }
          window.close();
        </script>
      `);
    }
  },

  status: async (req, res) => {
    let userObject = await oauthStore.getUser({cookie:req.sessionId});
    if (!userObject) userObject = {}
    res.json({
      authenticated: !!userObject.oauth2Client,
      userId: userObject.userId,
      sessionId: req.sessionId
    });
  },

  logout: async (req, res) => {
    // Clear session
    removeUser(req.sessionId);
    res.json({ success: true });
  }
};