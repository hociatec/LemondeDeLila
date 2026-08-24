import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'game_category_assignments' })
export class GameCategoryAssignmentEntity {
  @PrimaryColumn({ type: 'varchar', length: 120 })
  gameType!: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  categoryId!: string | null;
}
