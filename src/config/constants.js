import dotenv from 'dotenv';

// Charge les variables du fichier .env
dotenv.config();

// Liste des variables obligatoires
const requiredEnv = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'PORT'];

// Vérification rapide : si une clé manque, on arrête tout
requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Erreur : La variable d'environnement ${key} est manquante.`);
  }
});

export const config = {
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  YOUTUBE: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI
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