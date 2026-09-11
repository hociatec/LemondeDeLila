import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ADMIN_BOT_PORT,
  type AdminBotPort,
} from '../../ports/admin-bot.port';
function mapBotApplicationError(error: unknown): unknown {
  if (
    error == null ||
    typeof error !== 'object' ||
    !('code' in error) ||
    !('message' in error) ||
    typeof error.code !== 'string' ||
    typeof error.message !== 'string'
  ) {
    return error;
  }

  switch (error.code) {
    case 'BOT_ROOM_NOT_FOUND':
    case 'BOT_NOT_FOUND':
      return new NotFoundException(error.message);
    case 'BOT_ROOM_OWNER_REQUIRED':
      return new UnauthorizedException(error.message);
    default:
      return new BadRequestException(error.message);
  }
}

@Injectable()
export class AdminBotsService {
  constructor(
    @Inject(ADMIN_BOT_PORT)
    private readonly bots: AdminBotPort,
  ) {}

  async listNames() {
    const names = await this.bots.listNames();
    return {
      names: names.map((name) => ({
        id: name.id,
        name: name.name,
        enabled: name.enabled,
        createdAt: name.createdAt,
      })),
    };
  }

  getSettings() {
    return this.bots.getSettings();
  }

  async updateSettings(update: {
    botTurnDelayMs?: number;
    botStartDelayMs?: number;
    botDrawDelayMs?: number;
  }) {
    for (const value of [
      update.botTurnDelayMs,
      update.botStartDelayMs,
      update.botDrawDelayMs,
    ]) {
      if (
        value !== undefined &&
        (!Number.isSafeInteger(value) || value < 0 || value > 600_000)
      ) {
        throw new BadRequestException('Délai de bot invalide.');
      }
    }
    return this.bots.updateSettings(update);
  }

  async createName(name: string, enabled = true) {
    const normalizedName = normalizeBotName(name);
    try {
      await this.bots.createName(normalizedName, enabled === true);
    } catch (error) {
      throw mapBotApplicationError(error);
    }
    return this.listNames();
  }

  async updateName(id: number, update: { name?: string; enabled?: boolean }) {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new BadRequestException('Identifiant de nom de bot invalide.');
    }
    const normalizedUpdate = {
      ...(update.name === undefined ? {} : { name: normalizeBotName(update.name) }),
      ...(update.enabled === undefined ? {} : { enabled: update.enabled === true }),
    };
    try {
      await this.bots.updateName(id, normalizedUpdate);
    } catch (error) {
      throw mapBotApplicationError(error);
    }
    return this.listNames();
  }

  async deleteName(id: number) {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new BadRequestException('Identifiant de nom de bot invalide.');
    }
    try {
      await this.bots.deleteName(id);
    } catch (error) {
      throw mapBotApplicationError(error);
    }
    return this.listNames();
  }
}

function normalizeBotName(value: unknown): string {
  const normalized = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (!normalized || normalized.length > 150) {
    throw new BadRequestException('Nom de bot invalide.');
  }
  return normalized;
}
