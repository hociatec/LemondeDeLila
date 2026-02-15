import { GameContentLoaderService } from '../engine/services/game-content-loader.service';

type LoadV1Params = {
  gameType: string;
  baseDir: string;
  filename: string;
  contentDir?: string;
  arrayField?: string;
  minItems?: number;
  extraValidators?: Array<(payload: unknown) => void>;
};

export function loadV1Content<T>(
  contentLoader: GameContentLoaderService,
  params: LoadV1Params,
): T {
  const validators = [contentLoader.validators.version(1)];
  if (params.arrayField) {
    if (typeof params.minItems === 'number') {
      validators.push(
        contentLoader.validators.arrayField(params.arrayField, params.minItems),
      );
    } else {
      validators.push(contentLoader.validators.arrayField(params.arrayField));
    }
  }
  if (Array.isArray(params.extraValidators) && params.extraValidators.length) {
    validators.push(...params.extraValidators);
  }

  return contentLoader.loadContent<T>({
    gameType: params.gameType,
    baseDir: params.baseDir,
    ...(params.contentDir ? { contentDir: params.contentDir } : {}),
    filename: params.filename,
    validators,
  });
}
