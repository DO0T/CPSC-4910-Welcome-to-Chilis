const { loadEbaySecrets } = require('./ebay-secrets');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

afterEach(() => jest.restoreAllMocks());

test('does not contact Secrets Manager when no secret ID is configured', async () => {
  const retrieve = jest.fn();
  await expect(loadEbaySecrets({ env: {}, retrieve })).resolves.toBe(false);
  expect(retrieve).not.toHaveBeenCalled();
});

test('loads eBay credentials from a JSON secret before startup', async () => {
  const env = { EBAY_SECRET_ID: 'my-ebay-secret', EBAY_ENVIRONMENT: 'sandbox' };
  const retrieve = jest.fn().mockResolvedValue(JSON.stringify({
    EBAY_CLIENT_ID: 'app-id',
    EBAY_CLIENT_SECRET: 'cert-id',
    EBAY_ENVIRONMENT: 'production',
  }));

  await expect(loadEbaySecrets({ env, retrieve })).resolves.toBe(true);
  expect(retrieve).toHaveBeenCalledWith('my-ebay-secret');
  expect(env.EBAY_CLIENT_ID).toBe('app-id');
  expect(env.EBAY_CLIENT_SECRET).toBe('cert-id');
  expect(env.EBAY_ENVIRONMENT).toBe('production');
});

test('rejects an incomplete secret without changing existing credentials', async () => {
  const env = { EBAY_SECRET_ID: 'my-ebay-secret', EBAY_CLIENT_ID: 'existing-id' };
  const retrieve = jest.fn().mockResolvedValue('{"EBAY_CLIENT_ID":"new-id"}');

  await expect(loadEbaySecrets({ env, retrieve })).rejects.toThrow('must contain');
  expect(env.EBAY_CLIENT_ID).toBe('existing-id');
  expect(env.EBAY_CLIENT_SECRET).toBeUndefined();
});

test('rejects a non-JSON secret', async () => {
  const env = { EBAY_SECRET_ID: 'my-ebay-secret' };
  await expect(loadEbaySecrets({ env, retrieve: async () => 'not-json' }))
    .rejects.toThrow('JSON object');
});

test('retrieves the configured secret with the AWS SDK', async () => {
  const send = jest.spyOn(SecretsManagerClient.prototype, 'send').mockResolvedValue({
    SecretString: JSON.stringify({
      EBAY_CLIENT_ID: 'app-id',
      EBAY_CLIENT_SECRET: 'cert-id',
    }),
  });
  const destroy = jest.spyOn(SecretsManagerClient.prototype, 'destroy').mockImplementation(() => {});
  const env = { EBAY_SECRET_ID: 'my-ebay-secret', EBAY_ENVIRONMENT: 'sandbox' };

  await expect(loadEbaySecrets({ env })).resolves.toBe(true);
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0][0]).toBeInstanceOf(GetSecretValueCommand);
  expect(send.mock.calls[0][0].input).toEqual({ SecretId: 'my-ebay-secret' });
  expect(destroy).toHaveBeenCalledTimes(1);
  expect(env.EBAY_CLIENT_ID).toBe('app-id');
});

test('fails safely when Secrets Manager returns no text value', async () => {
  jest.spyOn(SecretsManagerClient.prototype, 'send').mockResolvedValue({});
  const destroy = jest.spyOn(SecretsManagerClient.prototype, 'destroy').mockImplementation(() => {});
  const env = { EBAY_SECRET_ID: 'my-ebay-secret' };

  await expect(loadEbaySecrets({ env })).rejects.toThrow('text value');
  expect(destroy).toHaveBeenCalledTimes(1);
  expect(env.EBAY_CLIENT_ID).toBeUndefined();
});
