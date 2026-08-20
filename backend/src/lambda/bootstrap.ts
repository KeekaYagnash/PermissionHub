import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

let bootstrapped: Promise<void> | undefined;

export function bootstrapLambdaEnvironment() {
  bootstrapped ??= loadLambdaEnvironment();
  return bootstrapped;
}

async function loadLambdaEnvironment() {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'af-south-1';
  const client = new SecretsManagerClient({ region });
  const [appSecret, databaseSecret] = await Promise.all([
    readJsonSecret(client, process.env.APP_SECRET_ARN),
    readJsonSecret(client, process.env.DATABASE_SECRET_ARN)
  ]);

  if (appSecret) {
    setIfPresent('SESSION_SECRET', appSecret.session_secret);
    setIfPresent('PERMISSIONHUB_CREDENTIAL_ENCRYPTION_KEY', appSecret.credential_encryption_key);
    setIfPresent('PROVISIONING_CONFIRMATION', appSecret.provisioning_confirmation);
    setIfPresent('AWS_LIVE_TEST_ALLOWED_PRINCIPALS', appSecret.aws_live_test_allowed_principals);
  }

  if (databaseSecret) {
    const host = process.env.DATABASE_HOST || databaseSecret.host;
    const port = process.env.DATABASE_PORT || String(databaseSecret.port || 5432);
    const database = process.env.DATABASE_NAME || databaseSecret.database || databaseSecret.dbname;
    const username = databaseSecret.username;
    const password = databaseSecret.password;
    if (host && port && database && username && password) {
      process.env.DATABASE_URL = `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
    } else if (databaseSecret.database_url && !process.env.DATABASE_URL) {
      process.env.DATABASE_URL = String(databaseSecret.database_url);
    }
  }
}

async function readJsonSecret(client: SecretsManagerClient, secretId?: string) {
  if (!secretId) return undefined;
  const response = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  if (!response.SecretString) return undefined;
  return JSON.parse(response.SecretString) as Record<string, string | number | undefined>;
}

function setIfPresent(key: string, value: unknown) {
  if (typeof value === 'string' && value.trim()) process.env[key] = value;
}
