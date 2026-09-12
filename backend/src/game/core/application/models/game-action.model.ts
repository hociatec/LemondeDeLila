import { Type } from 'class-transformer';
import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import type { PendingState } from './game-state.model';

export class GameSingleActionDto {
  @IsString()
  @MaxLength(128)
  type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  label?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}

export class GameActionListDto {
  @IsArray()
  @ArrayMaxSize(128)
  @ValidateNested({ each: true })
  @Type(() => GameSingleActionDto)
  actions!: GameSingleActionDto[];
}

export type GameStateResponse = GameStateWithActions;

/** Projection publique versionnée, distincte de l'état persistant interne. */
export interface GameStateWithActions {
  viewVersion: number;
  system: Record<string, unknown>;
  kits: Record<string, unknown>;
  effect: Record<string, unknown>;
  game: object;
  /** Version identity for the generic effect pack; absent in older servers. */
  gameContract?: {
    stateVersion: number;
    rulesVersion: string;
    contentVersion: string;
  };
  actions?: Array<{ type: string; label?: string; payload?: unknown }>;
  pending?: PendingState | null;
  actionCatalog?: readonly object[];
  timers?: Record<string, unknown>;
  [key: string]: unknown;
}
/** Explicitly named data contract at the application boundary. */
