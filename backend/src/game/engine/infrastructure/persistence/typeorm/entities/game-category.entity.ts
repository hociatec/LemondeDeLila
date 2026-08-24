import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'game_categories' })
export class GameCategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  parentId!: string | null;
}
