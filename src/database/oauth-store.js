import { MongoClient, ServerApiVersion } from 'mongodb'
import { google } from 'googleapis';
import { authService } from '../services/auth.service.js';
import { AppError } from '../utils/errors.js';
import { config } from '../config/constants.js';

const {DB_URI, DB_NAME} = config.MONGODB

const uri = DB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const db = client.db(DB_NAME);
const usersCollection = db.collection("users")

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await db.command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } 
  catch (e) {
    console.error(e)
  }
  finally {
  }
}
run().catch(console.dir);

class OAuthStore {
  constructor() {
    this.userIdMap = new Map();   // userId -> userObject
    this.cookieMap = new Map();   // cookie -> userObject
    this.oauthMap = new Map();    // oauth2Client -> userObject
  }

  // Récupère l'utilisateur par n'importe quel identifiant disponible
  async getUser({ cookie, userId, oauth2Client }) {
    let cacheResult
    if (cookie) cacheResult = this.cookieMap.get(cookie);
    if (userId) cacheResult = this.userIdMap.get(userId);
    if (oauth2Client) cacheResult = this.oauthMap.get(oauth2Client);
    if (cacheResult) return cacheResult;

    try {
      const result = await getUserObjectByDB(cookie, this)
      console.log(result)
      return result
    } catch (e) {
      console.error("db inaccessible", e)
    }
  }

  insertTemporaryUser({cookie, userId}) {
    generateOauth2()
    return this.saveUserInMap({cookie, userId})
  }

  // Utile pour les flux temporaires (ex: pendant le callback OAuth)
  async getTemporaryUser(criteria) {
    return await this.getUser(criteria);
  }

  saveUserInMap({ cookie, userId, oauth2Client, access_token, refresh_token }) {
    oauth2Client = oauth2Client ? oauth2Client : generateOauth2()
    const userObject = {
      cookie,
      userId,
      oauth2Client,
      tokens: { access_token, refresh_token },
      updatedAt: new Date()
    };

    // On lie cet objet dans toutes les Maps
    if (cookie) this.cookieMap.set(cookie, userObject);
    if (userId) this.userIdMap.set(userId, userObject);
    if (oauth2Client) this.oauthMap.set(oauth2Client, userObject);
    return userObject;
  }

  async insertUser(criteria) {
    const ob = this.saveUserInMap(criteria)
    await saveUserInDB(criteria)
    return ob
  }

  updateUser(searchCriteria, newData) {
    // 1. On récupère l'instance existante (la référence en mémoire)
    const user = this.getUser(searchCriteria);

    if (!user) {
      console.error("Utilisateur introuvable.");
      return null;
    }

    Object.assign(user, newData);

    // 3. Cas particulier : Si on a modifié le cookie ou le userId, 
    // il faut mettre à jour les index (les Maps) pour ne pas perdre le lien.
    if (newData.cookie) this.cookieMap.set(newData.cookie, user);
    if (newData.userId) this.userIdMap.set(newData.userId, user);
    if (newData.oauth2Client) this.oauthMap.set(newData.oauth2Client, user);

    return user;
  }

  removeUser({ cookie, userId, oauth2Client }) {
    // On récupère l'objet pour être sûr de tout supprimer partout
    const user = this.getUser({ cookie, userId, oauth2Client });
    
    if (user) {
      if (user.cookie) this.cookieMap.delete(user.cookie);
      if (user.userId) this.userIdMap.delete(user.userId);
      if (user.oauth2Client) this.oauthMap.delete(user.oauth2Client);
      return true;
    }
    return false;
  }

  // Pour ton débug et impressionner le jury
  getStats() {
    return {
      activeSessions: this.cookieMap.size,
      usersIdentified: this.userIdMap.size
    };
  }
}

function generateOauth2(access_token, refresh_token) {
  const client = new google.auth.OAuth2(
    config.YOUTUBE.client_id,
    config.YOUTUBE.client_secret,
    config.YOUTUBE.redirect_uri
  );

  const tokens = {};

  if (access_token) tokens.access_token = access_token;
  if (refresh_token) tokens.refresh_token = refresh_token;

  console.log(tokens)

  if (Object.keys(tokens).length > 0) {
    client.setCredentials(tokens);
  }

  return client;
}

async function saveUserInDB(userObject) {
  const {userId, oauth2Client, id_token, refresh_token, cookie} = userObject
  console.log(refresh_token)
  const ticket = await oauth2Client.verifyIdToken({
    idToken: id_token,
    audience: config.YOUTUBE.client_id,
  });
  const payload = ticket.getPayload();
  const googleId = payload['sub'];
  const query = { Id:googleId };
  const update = { 
    $set: { 
      userId,
      cookie,
      refresh_token,
      updatedAt: new Date()
    } 
  };
  const options = { upsert: true }; // TRÈS IMPORTANT : Crée l'utilisateur s'il n'existe pas, le met à jour sinon.

  await usersCollection.updateOne(query, update, options);
}

async function getUserObjectByDB(cookie, OAuthStore) {
  const userDoc = await usersCollection.findOne({ cookie })
  if (!userDoc) return null
  const {refresh_token, userId} = userDoc
  if (!refresh_token) return null
  const oauth2Client = generateOauth2(null, refresh_token)
  const userObject = {
    userId,
    cookie,
    oauth2Client
  }
  console.log(userObject)
  OAuthStore.saveUserInMap(userObject)
  return userObject
}

export const oauthStore = new OAuthStore()