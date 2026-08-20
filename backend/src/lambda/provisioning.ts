import { bootstrapLambdaEnvironment } from './bootstrap.js';

export async function handler(event: unknown) {
  await bootstrapLambdaEnvironment();
  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      message: 'Provisioning queue handler is deployed. Existing demo provisioning remains API-driven.',
      records: Array.isArray((event as any)?.Records) ? (event as any).Records.length : 0
    })
  };
}
