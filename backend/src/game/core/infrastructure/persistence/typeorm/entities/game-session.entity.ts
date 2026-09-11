import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { GameState } from '../../../../application/models/game-state.model';

@Entity({ name: 'game_sessions' })
export class GameSessionEntity {
  @PrimaryColumn({ name: 'room_id', type: 'int', unsigned: true })
  roomId!: number;

  @PrimaryColumn({ name: 'game_type', type: 'varchar', length: 120 })
  gameType!: string;

  @Column({ type: 'int', unsigned: true })
  version!: number;

  @Column({ type: 'json' })
  state!: GameState;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
