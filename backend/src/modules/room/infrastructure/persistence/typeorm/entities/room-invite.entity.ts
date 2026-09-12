import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'room_invites' })
@Index('idx_room_invites_active', [
  'roomId',
  'toUserId',
  'consumedAt',
  'expiresAt',
])
@Index('idx_room_invites_spectator', ['roomId', 'toUserId', 'expiresAt'])
export class RoomInviteEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id!: string;
  @Column({ name: 'room_id', type: 'int' }) roomId!: number;
  @Column({ name: 'from_user_id', type: 'int' })
  fromUserId!: number;
  @Column({ name: 'to_user_id', type: 'int' })
  toUserId!: number;
  @Column({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;
  @Column({ name: 'expires_at', type: 'datetime', precision: 6 })
  expiresAt!: Date;
  @Column({
    name: 'consumed_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  consumedAt!: Date | null;
}
