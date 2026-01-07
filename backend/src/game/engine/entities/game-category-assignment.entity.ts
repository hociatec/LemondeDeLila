import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'game_category_assignments' })
export class GameCategoryAssignmentEntity {
  @PrimaryColumn({ name: 'game_type', type: 'varchar', length: 100 })
  gameType!: string;

  @Index()
  @Column({ name: 'category_id', type: 'varchar', length: 120, nullable: true })
  categoryId!: string | null;
}
