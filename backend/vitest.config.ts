import { defineConfig } from 'vitest/config';
export default defineConfig({test:{environment:'node',exclude:['dist/**','node_modules/**'],env:{NODE_ENV:'test',AUTH_PROVIDER:'development',ENABLE_DEV_AUTH:'true',AUTH_ENABLED:'true',SESSION_SECRET:'test-session-secret-with-at-least-32-characters',AWS_LIVE_MODE:'false'}}});
