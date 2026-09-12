import { GameConfigurationError } from '../../domain/errors/game-domain.errors';

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
): asserts value is GameManifestMetadata {
  const fail = (field: string): never => {
    throw new GameConfigurationError(
      `Manifeste ${expected.code} incompatible : ${field}`,
    );
  };
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail('objet requis');
  const manifest = value as Record<string, unknown>;
  if (manifest.code !== expected.code) fail('code');
  if (manifest.engine !== expected.code) fail('engine');
  if (
    typeof manifest.code !== 'string' ||
    manifest.code.length > 128 ||
    typeof manifest.engine !== 'string' ||
    manifest.engine.length > 128
  )
    fail('identifiants');
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
  if (
    Number(manifest.minPlayers) < 1 ||
    Number(manifest.maxPlayers) < Number(manifest.minPlayers) ||
    Number(manifest.maxPlayers) > 64
  )
    fail('limites de joueurs');
  if (
    manifest.summary !== undefined &&
    (typeof manifest.summary !== 'string' || manifest.summary.length > 2000)
  )
    fail('summary');
  if (manifest.summary !== expected.summary) fail('summary');
}
