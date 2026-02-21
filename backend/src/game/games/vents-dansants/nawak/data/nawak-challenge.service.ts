import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { RandomService } from '../../../../modules/random/services/random.service';
import type { NawakChallenge } from '../model/nawak-challenge.model';
import type { NawakMetadata } from '../model/nawak-state.entity';

@Injectable()
export class NawakChallengeService {
  private readonly logger = new Logger(NawakChallengeService.name);
  private readonly challenges: NawakChallenge[];

  constructor(private readonly random: RandomService) {
    this.challenges = this.loadChallenges();
    if (!this.challenges.length) {
      this.logger.warn(
        'Aucun défi Nawak chargé. Ajoutez des données dans data/nawak-defis.txt.',
      );
    }
  }

  loadChallenge(meta: NawakMetadata): {
    challenge: NawakChallenge;
    meta: NawakMetadata;
  } {
    if (!this.challenges.length) {
      throw new Error('Pas de défi disponible pour Nawak !');
    }
    const seed = meta.rng ?? {};
    const { index, meta: rngMeta } = this.random.pickIndex(
      seed,
      this.challenges.length,
    );
    const challenge = this.challenges[index];
    return {
      challenge,
      meta: {
        ...meta,
        rng: rngMeta,
      },
    };
  }

  private loadChallenges(): NawakChallenge[] {
    const candidates = [
      path.resolve(__dirname, 'nawak-defis.txt'),
      path.resolve(
        process.cwd(),
        'src',
        'game',
        'games',
        'vents-dansants',
        'nawak',
        'data',
        'nawak-defis.txt',
      ),
    ];
    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) continue;
      try {
        const content = fs.readFileSync(candidate, 'utf-8');
        return this.parseContent(content);
      } catch (error: any) {
        this.logger.error(
          `Impossible de lire ${candidate} :`,
          error?.message ?? error,
        );
      }
    }
    this.logger.error(
      'Impossible de charger les défis Nawak : aucun fichier data/nawak-defis.txt accessible.',
    );
    return [];
  }

  private parseContent(content: string): NawakChallenge[] {
    const lines = content.split(/\r?\n/);
    const challenges: NawakChallenge[] = [];
    let idx = 0;

    while (idx < lines.length) {
      const rawLine = lines[idx].trim();
      if (!rawLine) {
        idx += 1;
        continue;
      }
      const headerMatch = rawLine.match(/^(\d+)\.$/);
      if (!headerMatch) {
        idx += 1;
        continue;
      }
      const id = headerMatch[1];
      idx += 1;
      const promptLines: string[] = [];
      while (idx < lines.length) {
        const line = lines[idx].trim();
        if (!line) {
          idx += 1;
          continue;
        }
        if (/^[123]\.$/.test(line)) {
          break;
        }
        if (/^\d+\.$/.test(line)) {
          break;
        }
        promptLines.push(line);
        idx += 1;
      }
      const prompt = promptLines.join(' ').trim();
      const answers: string[] = [];
      while (answers.length < 3 && idx < lines.length) {
        const marker = lines[idx].trim();
        if (!marker) {
          idx += 1;
          continue;
        }
        const answerMatch = marker.match(/^([123])\.$/);
        if (!answerMatch) {
          idx += 1;
          continue;
        }
        idx += 1;
        const answerParts: string[] = [];
        while (idx < lines.length) {
          const candidate = lines[idx].trim();
          if (!candidate) {
            idx += 1;
            continue;
          }
          if (/^[123]\.$/.test(candidate)) {
            break;
          }
          if (/^\d+\.$/.test(candidate)) {
            break;
          }
          answerParts.push(candidate);
          idx += 1;
        }
        if (answerParts.length) {
          answers.push(answerParts.join(' '));
        }
      }
      if (prompt && answers.length >= 3) {
        challenges.push({
          id,
          prompt,
          answers: [answers[0], answers[1], answers[2]],
        });
      }
    }
    return challenges;
  }
}
