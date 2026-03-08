import dotenv from 'dotenv';

// charge .env
dotenv.config();

// variables nécessaires
const requiredEnv = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'PORT'];

// Vérification rapide : si une clé manque, on arrête tout
const missingEnv = []
requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    missingEnv.push(key)
  }
});

if (missingEnv.length) throw new Error(`missing required variable(s) : ${missingEnv.join(", ")}`)

export const config = {
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  YOUTUBE: {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI
  },
  MONGODB: {
    DB_URI:process.env.DB_URI,
    DB_NAME:"YouTrie",
  },
  CACHE: {
    PLAYLIST_TTL: 86400, // 24h en secondes
    VIDEO_TTL: 43200     // 12h en secondes
  }
};