import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('@radix-ui')) {
              return 'vendor-ui';
            }
            if (id.includes('react-pdf') || id.includes('pdfjs-dist')) {
              return 'vendor-pdf';
            }
            if (id.includes('zustand') || id.includes('@tanstack')) {
              return 'vendor-state';
            }
            if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('lucide-react')) {
              return 'vendor-utils';
            }
            return 'vendor';
          }
        },
      },
    },
  },
})