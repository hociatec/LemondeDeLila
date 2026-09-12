import { getMetadataArgsStorage } from 'typeorm';
import { GameCatalogOverrideEntity } from './game-catalog-override.entity';

it('maps catalog override properties to the existing snake_case schema', () => {
  const columns = getMetadataArgsStorage().columns.filter(
    (column) => column.target === GameCatalogOverrideEntity,
  );
  const databaseNames = Object.fromEntries(
    columns.map((column) => [
      column.propertyName,
      column.options.name ?? column.propertyName,
    ]),
  );

  expect(databaseNames).toMatchObject({
    gameType: 'game_type',
    minPlayers: 'min_players',
    maxPlayers: 'max_players',
    chatEnabled: 'chat_enabled',
    chatSoundsEnabled: 'chat_sounds_enabled',
  });
});
