import type { GameShortcutHint, GameShortcutsContext } from '../../../../engine/shortcuts/game-shortcuts';
import { LamaSharedService } from '../shared/lama-shared.service';
export declare class LamaShortcutsService {
    constructor(_shared: LamaSharedService);
    getShortcuts(ctx: GameShortcutsContext<any>): GameShortcutHint[];
}
