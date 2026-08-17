import { Injectable } from '@nestjs/common';
import * as path from 'path';
import { GameContentLoaderService } from '../services/game-content-loader.service';
import type {
  BoardMissionClientCard,
  BoardMissionDeckCatalog,
  BoardMissionEventCard,
  BoardMissionResolvedModel,
  BoardMissionRules,
  BoardMissionTile,
} from './board-mission.types';

export interface BoardMissionContentJson<TItem> {
  version: 1;
  cards?: TItem[];
  tiles?: TItem[];
}

export interface BoardMissionLoadedModel
  extends
    BoardMissionResolvedModel<BoardMissionRules>,
    BoardMissionDeckCatalog<
      BoardMissionClientCard & { route?: string },
      BoardMissionEventCard
    > {
  board: {
    version: 1;
    tiles: BoardMissionTile[];
  };
}

@Injectable()
export class BoardMissionModelLoaderService {
  constructor(private readonly contentLoader: GameContentLoaderService) {}

  load(gameType: string, gameDir: string): BoardMissionLoadedModel {
    const baseDir = path.join(gameDir, '__content_loader__');

    const board = this.contentLoader.loadContent<
      BoardMissionLoadedModel['board']
    >({
      gameType,
      baseDir,
      contentDir: 'content',
      filename: 'board.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('tiles', 1),
      ],
    });

    const clients = this.contentLoader.loadContent<{
      version: 1;
      cards: Array<BoardMissionClientCard & { route?: string }>;
    }>({
      gameType,
      baseDir,
      contentDir: 'content',
      filename: 'clients.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('cards', 1),
      ],
    });

    const events = this.contentLoader.loadContent<{
      version: 1;
      cards: BoardMissionEventCard[];
    }>({
      gameType,
      baseDir,
      contentDir: 'content',
      filename: 'events.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('cards', 1),
      ],
    });

    const rules = this.contentLoader.loadContent<BoardMissionRules>({
      gameType,
      baseDir,
      contentDir: 'content',
      filename: 'rules.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('turnFlow', 1),
      ],
    });

    return { board, clients, events, rules };
  }
}
