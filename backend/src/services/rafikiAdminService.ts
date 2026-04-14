import crypto from 'crypto';
import { config } from '../config/env';
import { AppError } from '../middleware/errorHandler';

interface CreateWalletAddressResult {
  id: string;
  url: string;
  publicName?: string;
  asset?: { code: string; scale: number };
}

interface GraphQlResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

function signBodyHmacSha256(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * Rafiki Backend Admin API integration.
 * Used for tenant-scoped wallet address creation.
 */
export const rafikiAdminService = {
  async createWalletAddress(params: {
    publicName: string;
    assetId: string;
    username: string;
  }): Promise<CreateWalletAddressResult> {
    if (!config.rafikiAdminApiUrl || !config.rafikiTenantId || !config.rafikiTenantApiSecret) {
      throw AppError.badRequest(
        'Rafiki admin API is not configured. Set RAFIKI_ADMIN_API_URL, RAFIKI_TENANT_ID, RAFIKI_TENANT_API_SECRET, RAFIKI_WALLET_ASSET_ID.',
        'RAFIKI_ADMIN_NOT_CONFIGURED'
      );
    }

    const walletUrl = `${process.env.WALLET_ADDRESS_BASE_URL}/${params.username}`;

    const query = `
mutation CreateWalletAddress($input: CreateWalletAddressInput!) {
  createWalletAddress(input: $input) {
    walletAddress {
      id
      publicName
      url
      asset {
        code
        scale
      }
    }
  }
}`;

    const bodyObj = {
      query,
      variables: {
        input: {
          url: walletUrl,
          publicName: params.publicName,
          assetId: params.assetId,
        },
      },
    };
    const body = JSON.stringify(bodyObj);
    const signature = signBodyHmacSha256(body, config.rafikiTenantApiSecret);

    const res = await fetch(config.rafikiAdminApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'tenant-id': config.rafikiTenantId,
        signature,
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      throw AppError.ilpError(`Rafiki admin API error (${res.status}): ${text}`);
    }

    const json = (await res.json()) as GraphQlResponse<{
      createWalletAddress?: {
        walletAddress?: CreateWalletAddressResult;
      };
    }>;

    if (json.errors?.length) {
      throw AppError.ilpError(`Rafiki GraphQL error: ${json.errors[0].message}`);
    }

    const payload = json.data?.createWalletAddress;
    if (!payload?.walletAddress?.url) {
      throw AppError.ilpError('Failed to create wallet address in Rafiki');
    }

    return payload.walletAddress;
  },
};