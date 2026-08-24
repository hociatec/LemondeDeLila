import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('MnemoQuizStoreService persistence path', () => {
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    MNEMO_QUIZ_PATH: process.env.MNEMO_QUIZ_PATH,
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
  };
  const originalCwd = process.cwd();

  let tempRoot = '';
  let tempHome = '';

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lmdl-mnemo-store-'));
    tempHome = path.join(tempRoot, 'home');
    fs.mkdirSync(tempHome, { recursive: true });

    process.chdir(tempRoot);
    process.env.NODE_ENV = 'production';
    delete process.env.MNEMO_QUIZ_PATH;
    process.env.HOME = tempHome;
    process.env.USERPROFILE = tempHome;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    process.env.MNEMO_QUIZ_PATH = originalEnv.MNEMO_QUIZ_PATH;
    process.env.HOME = originalEnv.HOME;
    process.env.USERPROFILE = originalEnv.USERPROFILE;
    jest.dontMock('os');
    jest.resetModules();
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('bootstraps from legacy path to persistent path in production', async () => {
    const legacyPath = path.join(
      tempRoot,
      'data',
      'arche-de-mnemosyne',
      'quiz.json',
    );
    fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
    fs.writeFileSync(
      legacyPath,
      JSON.stringify({
        categories: [{ id: 'cat-a', name: 'Categorie A' }],
        questions: [],
      }),
      'utf-8',
    );

    const service = await createServiceWithHome(tempHome);
    service.onModuleInit();

    const persistentPath = path.join(
      tempHome,
      '.local',
      'share',
      'lemonde-de-lila',
      'arche-de-mnemosyne',
      'quiz.json',
    );

    expect(fs.existsSync(persistentPath)).toBe(true);
    const initial = JSON.parse(fs.readFileSync(persistentPath, 'utf-8'));
    expect(initial.categories).toHaveLength(1);
    expect(initial.categories[0].name).toBe('Categorie A');

    service.createCategory('Categorie B');

    const updated = JSON.parse(fs.readFileSync(persistentPath, 'utf-8'));
    expect(updated.categories.some((c: any) => c.name === 'Categorie B')).toBe(
      true,
    );
  });

  it('uses MNEMO_QUIZ_PATH override when provided', async () => {
    const customPath = path.join(tempRoot, 'custom-data', 'quiz.json');
    process.env.MNEMO_QUIZ_PATH = customPath;

    const service = await createServiceWithHome(tempHome);
    service.onModuleInit();
    service.createCategory('Categorie personnalisee');

    expect(fs.existsSync(customPath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(customPath, 'utf-8'));
    expect(
      data.categories.some((c: any) => c.name === 'Categorie personnalisee'),
    ).toBe(true);
  });

  async function createServiceWithHome(homePath: string): Promise<any> {
    jest.resetModules();
    jest.doMock('os', () => {
      const actual = jest.requireActual('os');
      return {
        ...actual,
        homedir: () => homePath,
      };
    });

    const mod = require('./mnemo-quiz-store.service') as typeof import('./mnemo-quiz-store.service');
    return new mod.MnemoQuizStoreService();
  }
});
