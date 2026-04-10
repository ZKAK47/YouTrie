import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Le dossier où se trouve ton index.html
  root: 'src/public', 
  
  build: {
    // On force la sortie dans src/dist
    outDir: resolve(__dirname, 'src/dist'),
    
    // On vide le dossier à chaque fois pour repartir propre
    emptyOutDir: true,
  },
  
  // On s'assure que Vite n'essaie pas de surveiller son propre dossier de build
  server: {
    watch: {
      ignored: ['**/src/dist/**']
    }
  }
});