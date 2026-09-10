import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  const verificationTags = [
    { name: 'google-site-verification', content: env.VITE_GOOGLE_SITE_VERIFICATION },
    { name: 'msvalidate.01', content: env.VITE_BING_SITE_VERIFICATION },
  ].filter((tag) => tag.content);

  return {
    plugins: [
      {
        name: 'search-verification-meta',
        transformIndexHtml() {
          return verificationTags.map((tag) => ({ tag: 'meta', attrs: tag, injectTo: 'head' as const }));
        },
      },
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    publicDir: 'public',
    build: {
      outDir: 'dist',
      sourcemap: mode === 'development',
      minify: mode === 'production' ? 'terser' : false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalized = id.replace(/\\/g, '/');
            if (normalized.includes('/src/screens/AdminDashboard')) return 'admin-dashboard';
            if (normalized.includes('/src/screens/')) return `screen-${normalized.split('/src/screens/')[1].split('.')[0].toLowerCase()}`;
            if (normalized.includes('/node_modules/recharts/') || normalized.includes('/node_modules/d3-')) return 'vendor-charts';
            if (normalized.includes('/node_modules/firebase/')) return 'vendor-firebase';
            if (normalized.includes('/node_modules/framer-motion/') || normalized.includes('/node_modules/motion-dom/')) return 'vendor-motion';
            if (normalized.includes('/node_modules/@stripe/')) return 'vendor-stripe';
            if (normalized.includes('/node_modules/react/') || normalized.includes('/node_modules/react-dom/') || normalized.includes('/node_modules/react-router')) return 'vendor-react';
          },
        },
      },
    },
    server: {
      port: 5173,
      strictPort: false,
      open: true,
      cors: true,
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
