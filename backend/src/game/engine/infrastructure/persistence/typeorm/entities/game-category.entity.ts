import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'game_categories' })
export class GameCategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ name: 'parent_id', type: 'varchar', length: 120, nullable: true })
  parentId!: string | null;
}
