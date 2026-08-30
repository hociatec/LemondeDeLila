import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { GameStateEntity } from '../../../../application/contracts/game-state.model';

@Entity({ name: 'game_session_snapshots' })
@Index('IDX_game_session_snapshots_version', ['roomId', 'gameType', 'version'])
export class GameSessionSnapshotEntity {
  @PrimaryColumn({ name: 'room_id', type: 'int', unsigned: true })
  roomId!: number;

  @PrimaryColumn({ name: 'game_type', type: 'varchar', length: 120 })
  gameType!: string;

  @PrimaryColumn({ type: 'int', unsigned: true })
  seq!: number;

  @Column({ type: 'int', unsigned: true })
  version!: number;

  @Column({ type: 'json' })
  state!: GameStateEntity;
}
