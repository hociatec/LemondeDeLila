import { Inject, Injectable } from '@nestjs/common';
import { GameContentValidationError } from '../../domain/errors/game-domain.errors';
import {
  GAME_CATALOG_READER,
  type GameCatalogReader,
} from '../ports/game-catalog.reader';

type ContentValidator = (payload: unknown) => void;

type LoadContentParams = {
  gameType: string;
  baseDir: string;
  filename: string;
  contentDir?: string;
  validators?: ContentValidator[];
};

@Injectable()
export class GameContentLoaderService {
  constructor(
    @Inject(GAME_CATALOG_READER)
    private readonly catalogReader: GameCatalogReader,
  ) {}

  readonly validators = {
    version:
      (expected: number): ContentValidator =>
      (payload: unknown) => {
        const actual = asRecord(payload)['version'];
        if (actual !== expected) {
          throw new GameContentValidationError(
            `Invalid content version for expected=${expected}`,
          );
        }
      },
    arrayField:
      (field: string, minItems = 0): ContentValidator =>
      (payload: unknown) => {
        const value = asRecord(payload)[field];
        if (!Array.isArray(value) || value.length < minItems) {
          throw new GameContentValidationError(
            `Invalid content array field: ${field}`,
          );
        }
      },
  };

  loadContent<T>(params: LoadContentParams): T {
    const payload = this.catalogReader.loadJsonFile<T>({
      baseDir: params.baseDir,
      contentDir: params.contentDir,
      filename: params.filename,
    });

    for (const validator of params.validators ?? []) {
      validator(payload);
    }

    return payload;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}
