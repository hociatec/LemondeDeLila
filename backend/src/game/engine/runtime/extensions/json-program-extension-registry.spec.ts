import { jsonProgramExtensions } from './json-program-extension-registry';

describe('JSON program extension registry', () => {
  it('is frozen, deterministic and has unique document and output keys', () => {
    expect(Object.isFrozen(jsonProgramExtensions)).toBe(true);
    expect(jsonProgramExtensions).toHaveLength(38);

    const documentKeys = jsonProgramExtensions.map(
      (extension) => extension.documentKey,
    );
    const outputKeys = jsonProgramExtensions.map(
      (extension) => extension.outputKey,
    );

    expect(new Set(documentKeys).size).toBe(documentKeys.length);
    expect(new Set(outputKeys).size).toBe(outputKeys.length);
    expect(documentKeys).toEqual([
      'pawnRace',
      'eventRace',
      'deliveryRace',
      'gooseRace',
      'collectionRace',
      'ecosystemRace',
      'pirateRace',
      'parade',
      'natureFamilies',
      'carAssembly',
      'wonderMarket',
      'mamanRace',
      'cardCircles',
      'mineDomain',
      'frousseRace',
      'galoponsRace',
      'professionFamilies',
      'fouleesRace',
      'galaxyRace',
      'midnightRace',
      'bananaTroops',
      'derapeRace',
      'balloonRace',
      'voyage',
      'catPattes',
      'gerard',
      'rites',
      'sac',
      'nawak',
      'olympia',
      'zigEtZag',
      'mnemosyne',
      'corridor',
      'contes',
      'lama',
      'judgedCards',
      'grid',
      'board',
    ]);
  });

  it('exposes the complete generic contribution contract for every profile', () => {
    for (const extension of jsonProgramExtensions) {
      expect(extension.schema).toBeDefined();
      expect(extension.compileUnknown).toEqual(expect.any(Function));
      expect(extension.collectActions).toEqual(expect.any(Function));
      expect(extension.collectHandlers).toEqual(expect.any(Function));
      expect(extension.validateUnknown).toEqual(expect.any(Function));
      expect(Object.isFrozen(extension)).toBe(true);
    }
  });
});
