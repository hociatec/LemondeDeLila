import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  readTextFileWithFallback,
  fixMojibakeString,
  fixMojibakeDeep,
  readJsonFileWithFallback,
} from './mojibake';

describe('Mojibake utilities', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mojibake-test-'));
  });

  afterAll(() => {
    // Cleanup temp directory
    if (fs.existsSync(tempDir)) {
      fs.readdirSync(tempDir).forEach((file) => {
        fs.unlinkSync(path.join(tempDir, file));
      });
      fs.rmdirSync(tempDir);
    }
  });

  describe('fixMojibakeString', () => {
    it('should return unchanged string for clean ASCII', () => {
      const input = 'Hello World';
      expect(fixMojibakeString(input)).toBe(input);
    });

    it('should return unchanged string for clean UTF-8', () => {
      const input = 'Bonjour été';
      expect(fixMojibakeString(input)).toBe(input);
    });

    it('should fix mojibake from Windows-1252 to UTF-8', () => {
      // "Ã©" is how "é" appears when UTF-8 is decoded as Windows-1252
      const mojibaked = 'Ã©tÃ©';
      const fixed = fixMojibakeString(mojibaked);
      // Should fix to "été" or similar
      expect(fixed).not.toBe(mojibaked);
      expect(fixed.includes('Ã')).toBe(false);
    });

    it('should handle replacement characters', () => {
      const input = 'Test\uFFFDchar';
      const result = fixMojibakeString(input);
      // Should attempt to fix or return best candidate
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle mixed content', () => {
      const input = 'Normal text with Ã© mojibake';
      const result = fixMojibakeString(input);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle empty string', () => {
      expect(fixMojibakeString('')).toBe('');
    });
  });

  describe('fixMojibakeDeep', () => {
    it('should fix strings in nested objects', () => {
      const input = {
        name: 'Ã©cole',
        nested: {
          value: 'forÃªt',
        },
      };
      const result = fixMojibakeDeep(input);
      expect(result.name).not.toBe('Ã©cole');
      expect(result.nested.value).not.toBe('forÃªt');
    });

    it('should fix strings in arrays', () => {
      const input = ['Ã©tÃ©', 'normal', 'forÃªt'];
      const result = fixMojibakeDeep(input);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      expect(result[0]).not.toBe('Ã©tÃ©');
    });

    it('should handle mixed array with objects', () => {
      const input = [
        { name: 'Ã©cole' },
        'normal string',
        { nested: { value: 'forÃªt' } },
      ];
      const result = fixMojibakeDeep(input);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      expect(result[0].name).not.toBe('Ã©cole');
    });

    it('should preserve clean strings', () => {
      const input = {
        name: 'clean',
        values: ['test', 'data'],
        nested: { value: 'nested' },
      };
      const result = fixMojibakeDeep(input);
      expect(result.name).toBe('clean');
      expect(result.values[0]).toBe('test');
      expect(result.nested.value).toBe('nested');
    });

    it('should handle null and undefined', () => {
      expect(fixMojibakeDeep(null)).toBe(null);
      expect(fixMojibakeDeep(undefined)).toBe(undefined);
    });

    it('should handle numbers', () => {
      expect(fixMojibakeDeep(42)).toBe(42);
      expect(fixMojibakeDeep(3.14)).toBe(3.14);
    });

    it('should handle booleans', () => {
      expect(fixMojibakeDeep(true)).toBe(true);
      expect(fixMojibakeDeep(false)).toBe(false);
    });

    it('should handle circular references without crashing', () => {
      const input: any = { label: 'ÃƒÂ©cole' };
      input.self = input;

      const result: any = fixMojibakeDeep(input);
      expect(result).toBeDefined();
      expect(result.self).toBe(result);
      expect(result.label).not.toBe('ÃƒÂ©cole');
    });

    it('should preserve shared references', () => {
      const shared: any = { value: 'forÃƒÂªt' };
      const input: any = { a: shared, b: shared };

      const result: any = fixMojibakeDeep(input);
      expect(result.a).toBe(result.b);
      expect(result.a.value).not.toBe('forÃƒÂªt');
    });
  });

  describe('readTextFileWithFallback', () => {
    it('should read clean UTF-8 file', () => {
      const testFile = path.join(tempDir, 'clean-utf8.txt');
      const content = 'Hello World\nBonjour été';
      fs.writeFileSync(testFile, content, 'utf8');

      const result = readTextFileWithFallback(testFile);
      expect(result).toBe(content);
    });

    it('should handle BOM in UTF-8', () => {
      const testFile = path.join(tempDir, 'utf8-bom.txt');
      const content = 'Test content';
      fs.writeFileSync(testFile, '\uFEFF' + content, 'utf8');

      const result = readTextFileWithFallback(testFile);
      expect(result).toBe(content); // BOM should be removed
    });

    it('should fallback to latin1 when UTF-8 has many replacement chars', () => {
      const testFile = path.join(tempDir, 'latin1.txt');
      // Write as latin1 (ISO-8859-1)
      const buffer = Buffer.from('été', 'latin1');
      fs.writeFileSync(testFile, buffer);

      const result = readTextFileWithFallback(testFile);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      // Should fallback to latin1 and read correctly
    });

    it('should throw error for non-existent file', () => {
      const nonExistent = path.join(tempDir, 'does-not-exist.txt');
      expect(() => readTextFileWithFallback(nonExistent)).toThrow();
    });
  });

  describe('readJsonFileWithFallback', () => {
    it('should read and parse clean JSON', () => {
      const testFile = path.join(tempDir, 'clean.json');
      const data = { name: 'test', value: 42, nested: { array: [1, 2, 3] } };
      fs.writeFileSync(testFile, JSON.stringify(data), 'utf8');

      const result = readJsonFileWithFallback(testFile);
      expect(result).toEqual(data);
    });

    it('should fix mojibake in JSON strings', () => {
      const testFile = path.join(tempDir, 'mojibake.json');
      // Simulate mojibake in JSON
      const data = { name: 'Ã©cole', description: 'forÃªt' };
      fs.writeFileSync(testFile, JSON.stringify(data), 'utf8');

      const result = readJsonFileWithFallback<typeof data>(testFile);
      expect(result.name).not.toBe('Ã©cole');
      expect(result.description).not.toBe('forÃªt');
    });

    it('should handle JSON with arrays', () => {
      const testFile = path.join(tempDir, 'array.json');
      const data = {
        items: ['Ã©tÃ©', 'normal', { nested: 'forÃªt' }],
      };
      fs.writeFileSync(testFile, JSON.stringify(data), 'utf8');

      const result = readJsonFileWithFallback<typeof data>(testFile);
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items.length).toBe(3);
    });

    it('should throw error for invalid JSON', () => {
      const testFile = path.join(tempDir, 'invalid.json');
      fs.writeFileSync(testFile, '{ invalid json }', 'utf8');

      expect(() => readJsonFileWithFallback(testFile)).toThrow();
    });

    it('should throw error for non-existent file', () => {
      const nonExistent = path.join(tempDir, 'does-not-exist.json');
      expect(() => readJsonFileWithFallback(nonExistent)).toThrow();
    });

    it('should preserve JSON types', () => {
      const testFile = path.join(tempDir, 'types.json');
      const data = {
        string: 'text',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        object: { nested: 'value' },
      };
      fs.writeFileSync(testFile, JSON.stringify(data), 'utf8');

      const result = readJsonFileWithFallback<typeof data>(testFile);
      expect(result.string).toBe('text');
      expect(result.number).toBe(42);
      expect(result.boolean).toBe(true);
      expect(result.null).toBe(null);
      expect(Array.isArray(result.array)).toBe(true);
      expect(typeof result.object).toBe('object');
    });
  });
});
