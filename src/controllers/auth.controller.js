import { oauthStore } from '../database/oauth-store.js';
import crypto from 'crypto';

export const authController = {
  initiate: (req, res) => {
    const cookieSessionId = req.sessionId;
    
    // oauth state generation for security reasons
    const oauthState = crypto.randomUUID();
    
    console.log('🔐 Initiate auth:', {
      cookieSessionId,
      oauthState
    });
    
    // store temp user in RAM and get the generated oauth2client
    const {oauth2Client} = oauthStore.insertTemporaryUser({cookie:cookieSessionId, userId:oauthState})

    // url for Google Account Consent Page
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
  
      // get the stored user info
      const clientObject = await oauthStore.getTemporaryUser({userId:oauthState})
      const cookieSessionId = clientObject.cookie
      
      if (!cookieSessionId) {
        throw new Error('No temporary user found or token expired');
      }


      const client = clientObject.oauth2Client;
      
      if (!client) {
        throw new Error('No Google Oauth client found');
      }
  
      // get the tokens by using the code sent by the Google callback
      const { tokens } = await client.getToken(code);
      const {refresh_token,access_token,id_token} = tokens
      // use tokens to connect the user
      client.setCredentials(tokens);
  
      // generate a permanent user_id
      const permanentUserId = `user_${crypto.randomBytes(8).toString('hex')}`;
  
      // remove the temporary user
      oauthStore.removeUser({cookie:cookieSessionId, userId:oauthState, oauth2Client:client})

      // store the permanent user in the database
      await oauthStore.insertUser({cookie:cookieSessionId, userId:permanentUserId, oauth2Client:client, refresh_token, access_token, id_token})
  
      // Close the Google connect window
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
      // Log the error and close the Google Connection window
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

  // Check if the user is connected
  status: async (req, res) => {
    // try to find the user's Google Account, it returns null if nothing was found
    let userObject = await oauthStore.getUser({cookie:req.sessionId});

    if (!userObject) userObject = {} // transform None/undefined into an object to avoid errors
    res.json({
      authenticated: !!userObject.oauth2Client, // the account exists (true or false)
      userId: userObject.userId,
      sessionId: req.sessionId
    });
  },

  
  // Clear session
  logout: async (req, res) => {
    removeUser(req.sessionId);
    res.json({ success: true });
  }
};