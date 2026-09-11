import { DataSource } from 'typeorm';
import { ORM_ENTITIES } from '../../../../../../app/database/typeorm-entities';
import { Room } from './room.entity';
import { RoomParticipant } from './room-participant.entity';
import { RoomBot } from './room-bot.entity';

class MetadataSource extends DataSource {
  build(): Promise<void> {
    return this.buildMetadatas();
  }
}

it('resolves the room projections to the actual entity and preserves cascades and inverse collections', async () => {
  const source = new MetadataSource({
    type: 'mysql',
    database: 'metadata_only',
    entities: [...ORM_ENTITIES],
  });
  await source.build();
  for (const entity of [RoomParticipant, RoomBot]) {
    const relation = source
      .getMetadata(entity)
      .findRelationWithPropertyPath('room');
    expect(relation?.inverseEntityMetadata.target).toBe(Room);
    expect(relation?.joinColumns.map((column) => column.databaseName)).toEqual([
      'room_id',
    ]);
    expect(relation?.onDelete).toBe('CASCADE');
  }
  const room = source.getMetadata(Room);
  expect(
    room.findRelationWithPropertyPath('participants')?.inverseRelation
      ?.propertyName,
  ).toBe('room');
  expect(
    room.findRelationWithPropertyPath('bots')?.inverseRelation?.propertyName,
  ).toBe('room');
});
