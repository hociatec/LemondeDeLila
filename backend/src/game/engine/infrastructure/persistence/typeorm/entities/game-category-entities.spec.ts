import { getMetadataArgsStorage } from 'typeorm';
import { GameCategoryAssignmentEntity } from './game-category-assignment.entity';
import { GameCategoryEntity } from './game-category.entity';

describe('game category entity mappings', () => {
  it('maps assignment properties to the snake_case migration schema', () => {
    expect(columnName(GameCategoryAssignmentEntity, 'gameType')).toBe(
      'game_type',
    );
    expect(columnName(GameCategoryAssignmentEntity, 'categoryId')).toBe(
      'category_id',
    );
  });

  it('maps the category parent to the snake_case migration schema', () => {
    expect(columnName(GameCategoryEntity, 'parentId')).toBe('parent_id');
  });
});

function columnName(
  target: abstract new (...args: never[]) => object,
  propertyName: string,
): string | undefined {
  return getMetadataArgsStorage().columns.find(
    (column) =>
      column.target === target && column.propertyName === propertyName,
  )?.options.name;
}
