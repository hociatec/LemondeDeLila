import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'game_catalog_overrides' })
export class GameCatalogOverrideEntity {
  @PrimaryColumn({ type: 'varchar', length: 120 })
  gameType!: string;

  @Column({ type: 'boolean', nullable: true })
  enabled!: boolean | null;

  @Column({ type: 'int', nullable: true })
  minPlayers!: number | null;

  @Column({ type: 'int', nullable: true })
  maxPlayers!: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  rules!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  status!: string | null;

  @Column({ type: 'boolean', nullable: true })
  chatEnabled!: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  chatSoundsEnabled!: boolean | null;
}
