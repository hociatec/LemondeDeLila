import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'game_catalog_overrides' })
export class GameCatalogOverrideEntity {
  @PrimaryColumn({ name: 'game_type', type: 'varchar', length: 100 })
  gameType!: string;

  @Column({ type: 'boolean', nullable: true })
  enabled?: boolean | null;

  @Column({ name: 'min_players', type: 'int', nullable: true })
  minPlayers?: number | null;

  @Column({ name: 'max_players', type: 'int', nullable: true })
  maxPlayers?: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name?: string | null;

  @Column({ type: 'text', nullable: true })
  description?: string | null;
}

