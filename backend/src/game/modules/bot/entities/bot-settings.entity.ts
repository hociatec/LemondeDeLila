import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'bot_settings' })
export class BotSettingsEntity {
  @PrimaryColumn({ type: 'tinyint' })
  id!: number;

  @Column({ name: 'bot_turn_delay_ms', type: 'int', default: 4000 })
  botTurnDelayMs!: number;

  @Column({ name: 'bot_start_delay_ms', type: 'int', default: 4000 })
  botStartDelayMs!: number;

  @Column({ name: 'bot_draw_delay_ms', type: 'int', default: 4000 })
  botDrawDelayMs!: number;
}
