import type {
  UserShortcuts,
  UserShortcut,
} from '../../domain/models/user-shortcuts.model';
export const USER_SHORTCUTS_REPOSITORY = Symbol('USER_SHORTCUTS_REPOSITORY');
export interface UserShortcutsRepository {
  get(userId: number): Promise<UserShortcuts>;
  replace(
    userId: number,
    revision: number,
    items: UserShortcut[],
  ): Promise<boolean>;
}
