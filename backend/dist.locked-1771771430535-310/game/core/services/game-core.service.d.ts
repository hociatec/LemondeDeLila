import { RoomPayload } from '../../../room/dto/room-response.dto';
import { GameStateEntity } from '../entities/game-state.entity';
export declare class GameCoreService {
    private sanitizePlayerName;
    buildBaseState(payload: RoomPayload, gameType: string): GameStateEntity;
    cloneState(state: GameStateEntity): GameStateEntity;
    appendLog(state: GameStateEntity, message: string): GameStateEntity;
    private buildPlayers;
    private shouldRandomizeStarter;
    private shufflePlayers;
}
