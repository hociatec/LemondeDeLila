import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export class AbsurdissimesDeckService {
  private readonly logger = new Logger(AbsurdissimesDeckService.name);
  private readonly whiteCards: string[];
  private readonly blackCards: string[];

  constructor() {
    this.whiteCards = this.loadCards('white-cards.txt');
    this.blackCards = this.loadCards('black-cards.txt');
  }

  getWhiteCards(): string[] {
    return [...this.whiteCards];
  }

  getBlackCards(): string[] {
    return [...this.blackCards];
  }

  private loadCards(fileName: string): string[] {
    const filePath = this.resolveDataPath(fileName);
    if (!filePath) {
      this.logger.error(`Fichier de cartes introuvable : ${fileName}`);
      return [];
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return this.parseCards(raw);
    } catch (error: unknown) {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message ?? 'erreur inconnue')
          : 'erreur inconnue';
      this.logger.error(
        `Impossible de lire ${fileName} : ${message}`,
      );
      return [];
    }
  }

  private resolveDataPath(fileName: string): string | null {
    const candidates = [
      path.resolve(__dirname, 'data', fileName),
      path.resolve(
        process.cwd(),
        'src',
        'game',
        'games',
        'vents-dansants',
        'les-absurdissimes',
        'data',
        fileName,
      ),
      path.resolve(
        process.cwd(),
        'dist',
        'game',
        'games',
        'vents-dansants',
        'les-absurdissimes',
        'data',
        fileName,
      ),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  private parseCards(content: string): string[] {
    const cards: string[] = [];
    const regex = /(\d+)\.\s*[\r\n]+([\s\S]*?)(?=\n\d+\.|$)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content))) {
      const raw = match[2].trim();
      if (raw) {
        const normalized = raw
          .replace(/[\r\n]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        cards.push(normalized);
      }
    }
    return cards;
  }
}
