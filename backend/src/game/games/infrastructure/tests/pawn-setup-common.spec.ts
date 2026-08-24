import * as fs from 'node:fs';
import * as path from 'node:path';

describe('pawn setup common flow', () => {
  const root = path.resolve(__dirname, '../../..');
  const setupFiles = [
    'games/vents-sacres/jeu-oie/application/services/jeu-oie-setup.service.ts',
    'games/les-quatre-vents/galopons-ensemble/setup/galopons-setup.service.ts',
    'games/les-quatre-vents/aventure-sauvage/setup/aventure-sauvage-setup.service.ts',
    'games/les-quatre-vents/frousse-party/setup/frousse-setup.service.ts',
    'games/les-quatre-vents/a-fond-les-ballons/setup/a-fond-les-ballons-setup.service.ts',
    'games/les-quatre-vents/contes-et-cacahuetes/setup/contes-et-cacahuetes-setup.service.ts',
    'games/les-quatre-vents/en-attendant-minuit/setup/minuit-setup.service.ts',
  ];

  it('routes pawn setup services through the shared configured helper', () => {
    for (const relativeFile of setupFiles) {
      const file = path.resolve(root, relativeFile);
      const source = fs.readFileSync(file, 'utf8');

      expect(source).toContain('queueConfiguredPawnSelection');
      expect(source).not.toContain('createSequentialPawnPending(');
    }
  });
});

