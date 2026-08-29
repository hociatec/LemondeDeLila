import { Injectable } from '@nestjs/common';

@Injectable()
export class ChatSettingsPolicyService {
  static readonly DEFAULT_HISTORY_LIMIT = 200;
  static readonly MIN_HISTORY_LIMIT = 1;
  static readonly MAX_HISTORY_LIMIT = 2000;
  static readonly DEFAULT_EDIT_WINDOW_SECONDS = 5 * 60;
  static readonly MIN_EDIT_WINDOW_SECONDS = 0;
  static readonly MAX_EDIT_WINDOW_SECONDS = 24 * 60 * 60;

  clampHistoryLimit(value: number): number {
    const candidate = Number(value);
    if (!Number.isFinite(candidate)) {
      return ChatSettingsPolicyService.DEFAULT_HISTORY_LIMIT;
    }
    const rounded = Math.round(candidate);
    if (rounded < ChatSettingsPolicyService.MIN_HISTORY_LIMIT) {
      return ChatSettingsPolicyService.MIN_HISTORY_LIMIT;
    }
    if (rounded > ChatSettingsPolicyService.MAX_HISTORY_LIMIT) {
      return ChatSettingsPolicyService.MAX_HISTORY_LIMIT;
    }
    return rounded;
  }

  clampEditWindowSeconds(value: number): number {
    const candidate = Number(value);
    if (!Number.isFinite(candidate)) {
      return ChatSettingsPolicyService.DEFAULT_EDIT_WINDOW_SECONDS;
    }
    const rounded = Math.round(candidate);
    if (rounded < ChatSettingsPolicyService.MIN_EDIT_WINDOW_SECONDS) {
      return ChatSettingsPolicyService.MIN_EDIT_WINDOW_SECONDS;
    }
    if (rounded > ChatSettingsPolicyService.MAX_EDIT_WINDOW_SECONDS) {
      return ChatSettingsPolicyService.MAX_EDIT_WINDOW_SECONDS;
    }
    return rounded;
  }
}
