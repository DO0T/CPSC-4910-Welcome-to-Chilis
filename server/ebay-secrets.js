const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

// Secrets Manager is optional. Local development can keep using server/.env.
async function retrieveSecretString(secretId) {
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION || undefined });
  try {
    const response = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
    if (typeof response.SecretString !== 'string' || !response.SecretString) {
      throw new Error('The eBay secret must contain a text value.');
    }
    return response.SecretString;
  } finally {
    client.destroy();
  }
}

async function loadEbaySecrets({ env = process.env, retrieve = retrieveSecretString } = {}) {
  const secretId = env.EBAY_SECRET_ID?.trim();
  if (!secretId) return false;

  const secretString = await retrieve(secretId);
  let secret;
  try {
    secret = JSON.parse(secretString);
  } catch {
    throw new Error('The eBay secret must be a JSON object.');
  }

  if (!secret || typeof secret !== 'object' || Array.isArray(secret) ||
      typeof secret.EBAY_CLIENT_ID !== 'string' || !secret.EBAY_CLIENT_ID.trim() ||
      typeof secret.EBAY_CLIENT_SECRET !== 'string' || !secret.EBAY_CLIENT_SECRET.trim()) {
    throw new Error('The eBay secret must contain EBAY_CLIENT_ID and EBAY_CLIENT_SECRET.');
  }

  const ebayEnvironment = secret.EBAY_ENVIRONMENT || env.EBAY_ENVIRONMENT || 'sandbox';
  if (!['sandbox', 'production'].includes(ebayEnvironment)) {
    throw new Error('EBAY_ENVIRONMENT must be sandbox or production.');
  }

  env.EBAY_CLIENT_ID = secret.EBAY_CLIENT_ID;
  env.EBAY_CLIENT_SECRET = secret.EBAY_CLIENT_SECRET;
  env.EBAY_ENVIRONMENT = ebayEnvironment;
  return true;
}

module.exports = { loadEbaySecrets };
