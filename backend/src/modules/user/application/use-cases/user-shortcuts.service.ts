import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  USER_SHORTCUTS_REPOSITORY,
  type UserShortcutsRepository,
} from '../ports/user-shortcuts.repository';
import { validateShortcuts } from '../../domain/policies/user-shortcuts.policy';
import type {
  UserShortcuts,
  UserShortcut,
} from '../../domain/models/user-shortcuts.model';

@Injectable()
export class UserShortcutsService {
  constructor(
    @Inject(USER_SHORTCUTS_REPOSITORY)
    private readonly repository: UserShortcutsRepository,
  ) {}
  get(userId: number): Promise<UserShortcuts> {
    return this.repository.get(userId);
  }
  async replace(userId: number, payload: unknown): Promise<UserShortcuts> {
    if (!payload || typeof payload !== 'object')
      throw new BadRequestException('Préférences invalides.');
    const data = payload as Record<string, unknown>;
    if (
      !Number.isSafeInteger(data.revision) ||
      Number(data.revision) < 0 ||
      Number(data.revision) >= 2_000_000_000
    )
      throw new BadRequestException('Version invalide.');
    let items: UserShortcut[];
    try {
      items = validateShortcuts(data.items);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Raccourcis invalides.',
      );
    }
    if (!(await this.repository.replace(userId, Number(data.revision), items)))
      throw new ConflictException(
        'Vos raccourcis ont changé sur un autre appareil. Actualisez avant de réessayer.',
      );
    return { revision: Number(data.revision) + 1, items };
  }
}
