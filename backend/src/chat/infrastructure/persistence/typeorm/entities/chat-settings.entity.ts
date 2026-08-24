import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'chat_settings' })
export class ChatSettingsEntity {
  @PrimaryColumn({ type: 'tinyint' })
  id!: number;

  @Column({ name: 'chat_history_limit', type: 'int', default: 200 })
  chatHistoryLimit!: number;

  @Column({ name: 'edit_window_seconds', type: 'int', default: 300 })
  editWindowSeconds!: number;
}
