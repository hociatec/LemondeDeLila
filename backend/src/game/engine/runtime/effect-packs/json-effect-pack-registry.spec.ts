import {
  jsonEffectPacksByDomain,
  jsonEffectPacks,
} from './json-effect-pack-registry';
import { compileJsonGame } from '../definitions/json-game-compiler';
import pathWallsManifest from '../../../games/vents-sacres/corridor/manifest.json';
import pathWallsDocument from '../../../games/vents-sacres/corridor/game.json';

describe('JSON effect-pack registry', () => {
  it('is frozen, deterministic and has unique document and output keys', () => {
    expect(Object.isFrozen(jsonEffectPacks)).toBe(true);
    expect(jsonEffectPacks).toHaveLength(38);

    const documentKeys = jsonEffectPacks.map(
      (extension) => extension.documentKey,
    );
    const outputKeys = jsonEffectPacks.map((extension) => extension.outputKey);

    expect(new Set(documentKeys).size).toBe(documentKeys.length);
    expect(new Set(outputKeys).size).toBe(outputKeys.length);
    expect(documentKeys).toEqual([
      'pawnRace',
      'eventRace',
      'deliveryRace',
      'gooseRace',
      'trackZoneCollection',
      'resourceTrackRace',
      'treasureTrackRace',
      'parade',
      'familyRequest',
      'carAssembly',
      'marketExchange',
      'pairedPawnRace',
      'cardCircles',
      'publicDomainCards',
      'protectedHauntedRace',
      'bidirectionalCollisionRace',
      'familyEffects',
      'teamPawnRace',
      'quizEventRace',
      'bounceQuizRace',
      'speciesTroops',
      'directionalHazardRace',
      'chainedTileRace',
      'chapterEncounter',
      'pawScoring',
      'themeNameCards',
      'ritualPhases',
      'propertyEconomy',
      'anonymousVote',
      'sharedPrestigeCards',
      'battleTies',
      'simultaneousQuiz',
      'pathWalls',
      'storyChallenge',
      'discardPenaltyCards',
      'judgedCards',
      'grid',
      'board',
    ]);
  });

  it('exposes the complete generic contribution contract for every profile', () => {
    for (const extension of jsonEffectPacks) {
      expect(extension.scope).toBe('generic');
      expect([
        'board',
        'cards',
        'choice',
        'collection',
        'race',
        'spatial',
      ]).toContain(extension.domain);
      expect(extension.schema).toBeDefined();
      expect(extension.compileUnknown).toEqual(expect.any(Function));
      expect(extension.collectActions).toEqual(expect.any(Function));
      expect(extension.collectHandlers).toEqual(expect.any(Function));
      expect(extension.validateUnknown).toEqual(expect.any(Function));
      expect(Object.isFrozen(extension)).toBe(true);
    }
    expect(
      jsonEffectPacks.every((extension) => extension.scope === 'generic'),
    ).toBe(true);
    expect(
      Object.fromEntries(
        Object.entries(jsonEffectPacksByDomain).map(([domain, packs]) => [
          domain,
          packs.length,
        ]),
      ),
    ).toEqual({
      board: 3,
      cards: 9,
      choice: 5,
      collection: 6,
      race: 14,
      spatial: 1,
    });
    expect(Object.isFrozen(jsonEffectPacksByDomain)).toBe(true);
    expect(
      Object.values(jsonEffectPacksByDomain).every((packs) =>
        Object.isFrozen(packs),
      ),
    ).toBe(true);
  });

  it('compiles a new game identity by reusing only an existing JSON mechanic', () => {
    const manifest = {
      ...pathWallsManifest,
      code: 'new-path-walls-game',
      engine: 'new-path-walls-game',
      name: 'New path walls game',
    };
    const compiled = compileJsonGame(
      manifest,
      structuredClone(pathWallsDocument),
    );

    expect(compiled.id).toBe('new-path-walls-game');
    expect(Object.keys(compiled.actions)).toEqual([
      'pathWalls_move',
      'pathWalls_place_wall',
    ]);
    expect(jsonEffectPacks).toHaveLength(38);
  });
});
