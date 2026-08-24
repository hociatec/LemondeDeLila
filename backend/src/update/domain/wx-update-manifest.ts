export const WX_UPDATE_SCHEMA_VERSION = 2 as const;
export const WX_UPDATE_SIGNATURE_ALGORITHM = 'rsa-pkcs1-sha256' as const;
export const WX_UPDATE_PRODUCT = 'client-wx' as const;
export const WX_UPDATE_PLATFORM = 'windows' as const;
export const WX_UPDATE_ARCHITECTURE = 'x64' as const;
export const WX_UPDATE_CHANNEL = 'stable' as const;

export type WxUpdateManifest = {
  schemaVersion: typeof WX_UPDATE_SCHEMA_VERSION;
  product: typeof WX_UPDATE_PRODUCT;
  platform: typeof WX_UPDATE_PLATFORM;
  architecture: typeof WX_UPDATE_ARCHITECTURE;
  channel: typeof WX_UPDATE_CHANNEL;
  releaseId: string;
  version: string;
  sequence: number;
  publishedAt: string;
  mandatoryAt: string | null;
  minimumVersion: string | null;
  message: string | null;
  artifact: {
    url: string;
    size: number;
    sha256: string;
    signature: string;
    signatureAlgorithm: typeof WX_UPDATE_SIGNATURE_ALGORITHM;
  };
};

export type WxUpdateManifestResponse = WxUpdateManifest & {
  currentVersion: string | null;
  updateAvailable: boolean | null;
  updateRequired: boolean;
  mandatory: boolean;
};

export type WxUpdateSignatureFields = Pick<
  WxUpdateManifest,
  | 'releaseId'
  | 'version'
  | 'sequence'
  | 'publishedAt'
  | 'mandatoryAt'
  | 'minimumVersion'
> & {
  artifactSize: number;
  artifactSha256: string;
};

export function canonicalizeWxUpdateSignature(
  fields: WxUpdateSignatureFields,
): string {
  return [
    'lila-client-wx-manifest-v2',
    `product=${WX_UPDATE_PRODUCT}`,
    `platform=${WX_UPDATE_PLATFORM}`,
    `architecture=${WX_UPDATE_ARCHITECTURE}`,
    `channel=${WX_UPDATE_CHANNEL}`,
    `releaseId=${fields.releaseId}`,
    `version=${fields.version}`,
    `sequence=${fields.sequence}`,
    `publishedAt=${fields.publishedAt}`,
    `mandatoryAt=${fields.mandatoryAt ?? '-'}`,
    `minimumVersion=${fields.minimumVersion ?? '-'}`,
    `artifactSize=${fields.artifactSize}`,
    `artifactSha256=${fields.artifactSha256.toLowerCase()}`,
  ].join('\n');
}
