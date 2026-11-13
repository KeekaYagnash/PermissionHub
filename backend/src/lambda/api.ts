import serverless from 'serverless-http';
import { bootstrapLambdaEnvironment } from './bootstrap.js';

let handlerPromise: Promise<ReturnType<typeof serverless>> | undefined;

async function getHandler() {
  handlerPromise ??= (async () => {
    await bootstrapLambdaEnvironment();
    const { app } = await import('../app.js');
    return serverless(app, {
      request(request: any, event: any) {
        (request as any).apiGateway = { event };
      }
    });
  })();
  return handlerPromise;
}

export async function handler(event: unknown, context: unknown) {
  const expressHandler = await getHandler();
  return expressHandler(event as any, context as any);
}
