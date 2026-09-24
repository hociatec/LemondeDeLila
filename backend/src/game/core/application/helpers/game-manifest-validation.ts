import { GameConfigurationError } from '../../../engine/runtime/contracts/game-domain.errors';

export type GameManifestMetadata = {
  code: string;
  name: string;
  engine: string;
  minPlayers: number;
  maxPlayers: number;
  summary?: string;
};

/** Compiled runtime metadata and the installed catalogue must describe one game. */
export function assertGameManifestMatches(
  value: unknown,
  expected: Omit<GameManifestMetadata, 'engine'>,
  diagnostic?: (field: string, received: unknown) => never,
): asserts value is GameManifestMetadata {
  const fail = (field: string): never => {
    if (diagnostic) {
      const descriptor =
        value && typeof value === 'object'
          ? Object.getOwnPropertyDescriptor(value, field)
          : undefined;
      diagnostic(
        field,
        descriptor && 'value' in descriptor ? descriptor.value : undefined,
      );
    }
    throw new GameConfigurationError(
      `Manifeste ${expected.code} incompatible : ${field}`,
    );
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('');
  const manifest = value as Record<string, unknown>;
  if (manifest.code !== expected.code) fail('code');
  if (manifest.engine !== expected.code) fail('engine');
  for (const field of ['code', 'engine'] as const)
    if (typeof manifest[field] !== 'string' || manifest[field].length > 128)
      fail(field);
  if (
    typeof manifest.name !== 'string' ||
    !manifest.name.trim() ||
    manifest.name !== expected.name
  )
    fail('name');
  for (const field of ['minPlayers', 'maxPlayers'] as const) {
    if (
      !Number.isSafeInteger(manifest[field]) ||
      manifest[field] !== expected[field]
    )
      fail(field);
  }
  if (Number(manifest.minPlayers) < 1) fail('minPlayers');
  if (
    Number(manifest.maxPlayers) < Number(manifest.minPlayers) ||
    Number(manifest.maxPlayers) > 64
  )
    fail('maxPlayers');
  if (
    manifest.summary !== undefined &&
    (typeof manifest.summary !== 'string' || manifest.summary.length > 2000)
  )
    fail('summary');
  if (manifest.summary !== expected.summary) fail('summary');
}
