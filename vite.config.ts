import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte({
      onwarn(warning, defaultHandler) {
        // Intentional: initialData is captured once as the initial $state value
        if (warning.code === 'state_referenced_locally') return
        defaultHandler?.(warning)
      },
    }),
    react(),
    tailwindcss(),
  ],
  define: { global: "window" }
})
