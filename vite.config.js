import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Set base to your repository name for GitHub Pages
  // For example, if repo is github.com/username/resturant-ordering, use '/resturant-ordering/'
  base: '/pos/', // Change this to match your GitHub repository name
})
