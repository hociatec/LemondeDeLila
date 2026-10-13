import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import type { UserShortcut } from '../../../../domain/models/user-shortcuts.model';
import type { User } from './user.entity';

@Entity({ name: 'user_shortcuts' })
export class UserShortcutsEntity {
  @PrimaryColumn({ name: 'user_id', type: 'int' }) userId!: number;
  @OneToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_user_shortcuts_user',
  })
  user!: User;
  @Column({ type: 'int', default: 0 }) revision!: number;
  @Column({ type: 'json' }) items!: UserShortcut[];
}
