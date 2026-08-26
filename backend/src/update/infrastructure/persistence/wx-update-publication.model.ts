export type PublishWxUpdateInput = {
  zipPath: string;
  installerZipPath?: string | null;
  releaseId: string;
  version: string;
  sequence: number;
  publishedAt: string;
  message?: string | null;
  minimumVersion?: string | null;
  mandatoryAt?: string | null;
  expectedSha256: string;
  expectedInstallerSha256?: string | null;
  signature: string;
};

export type ValidatedWxArtifact = { size: number; sha256: string };
