import { bootstrapLambdaEnvironment } from './bootstrap.js';

export async function handler() {
  await bootstrapLambdaEnvironment();
  return {
    ok: true,
    message: 'Expiry worker is deployed but disabled unless enable_expiry_worker is true.'
  };
}
