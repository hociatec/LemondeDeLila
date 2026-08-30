import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { GameEvent } from '../../../../application/contracts/game-event.model';

@Entity({ name: 'game_session_events' })
@Index('IDX_game_session_events_version', ['roomId', 'gameType', 'version'])
export class GameSessionEventEntity {
  @PrimaryColumn({ name: 'room_id', type: 'int', unsigned: true })
  roomId!: number;

  @PrimaryColumn({ name: 'game_type', type: 'varchar', length: 120 })
  gameType!: string;

  @PrimaryColumn({ type: 'int', unsigned: true })
  seq!: number;

  @Column({ type: 'int', unsigned: true })
  version!: number;

  @Column({ type: 'json' })
  event!: GameEvent;
}
