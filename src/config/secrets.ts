import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

let loaded = false;

export async function loadRuntimeSecrets() {
  if (loaded) return;
  loaded = true;

  const secretId = process.env.THE_CRUNCH_SECRET_ID;
  if (!secretId) return;

  const client = new SecretsManagerClient({});
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretId }),
  );

  if (!response.SecretString) return;

  const values = JSON.parse(response.SecretString) as Record<string, string>;
  for (const [key, value] of Object.entries(values)) {
    if (value && !process.env[key]) {
      process.env[key] = value;
    }
  }
}
