import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react'; // <--- 1. IMPORTA EL PLUGIN

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // 2. AÑADE LA SECCIÓN plugins:
      plugins: [react()], // <--- Asegúrate de que esta línea esté aquí

      // Mantén tu configuración existente:
      define: {
        'process.env.API_KEY': JSON.stringify(env.API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
      // Fin de tu configuración existente
    };
});