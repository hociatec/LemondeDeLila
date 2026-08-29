import { Injectable } from '@nestjs/common';

import { ChatNormalizedMessage } from '../models/chat-message.record';

@Injectable()
export class ChatMessageCacheService {
  static readonly CACHE_LIMIT = 2000;

  private historyCache: ChatNormalizedMessage[] | null = null;

  getAll(): ChatNormalizedMessage[] | null {
    return this.historyCache;
  }

  setAll(messages: ChatNormalizedMessage[]): void {
    this.historyCache = messages.slice(-ChatMessageCacheService.CACHE_LIMIT);
  }

  append(message: ChatNormalizedMessage): void {
    if (this.historyCache === null) {
      this.historyCache = [];
    }
    this.historyCache.push(message);
    if (this.historyCache.length > ChatMessageCacheService.CACHE_LIMIT) {
      this.historyCache.splice(
        0,
        this.historyCache.length - ChatMessageCacheService.CACHE_LIMIT,
      );
    }
  }

  replace(message: ChatNormalizedMessage): void {
    if (!this.historyCache) {
      return;
    }
    const index = this.historyCache.findIndex(
      (entry) => entry.id === message.id,
    );
    if (index >= 0) {
      this.historyCache[index] = message;
      return;
    }
    this.append(message);
  }

  remove(messageId: string): void {
    if (!this.historyCache) {
      return;
    }
    const index = this.historyCache.findIndex(
      (entry) => entry.id === messageId,
    );
    if (index >= 0) {
      this.historyCache.splice(index, 1);
    }
  }

  clear(): void {
    this.historyCache = [];
  }
}
