import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'game_categories' })
export class GameCategoryEntity {
  @PrimaryColumn({ type: 'varchar', length: 120 })
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ name: 'parent_id', type: 'varchar', length: 120, nullable: true })
  parentId!: string | null;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;
}

