export class BotNameNormalizerService {
  sanitize(name: string): string {
    const normalized = name.replace(/\s+/g, ' ').trim();
    return normalized.length > 100 ? normalized.slice(0, 100) : normalized;
  }
}
