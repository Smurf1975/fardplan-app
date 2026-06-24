import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Om du döper GitHub-repot till "fardplan", sätt base till '/fardplan/'
  // Om du använder en custom domän, sätt base till '/'
  base: '/fardplan/',
});
