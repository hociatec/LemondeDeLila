import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'bot_settings' })
export class BotSettingsEntity {
  @PrimaryColumn({ type: 'tinyint' })
  id!: number;

  @Column({ name: 'bot_turn_delay_ms', type: 'int', default: 600 })
  botTurnDelayMs!: number;

  @Column({ name: 'bot_start_delay_ms', type: 'int', default: 250 })
  botStartDelayMs!: number;

  @Column({ name: 'bot_draw_delay_ms', type: 'int', default: 250 })
  botDrawDelayMs!: number;
}
