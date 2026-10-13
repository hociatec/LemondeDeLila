import { BadRequestException, ConflictException } from '@nestjs/common';
import { UserShortcutsService } from './user-shortcuts.service';
import { validateShortcuts } from '../../domain/policies/user-shortcuts.policy';

const shortcut = {
  target: 'game:chess',
  label: 'Chess',
  chord: 'CTRL+SHIFT+J',
  enabled: true,
};

describe('Personal shortcuts', () => {
  const repository = { get: jest.fn(), replace: jest.fn() };
  const service = new UserShortcutsService(repository);
  beforeEach(() => jest.resetAllMocks());

  it('loads the requested account and saves normalized preferences with a new revision', async () => {
    repository.get.mockResolvedValue({ revision: 2, items: [shortcut] });
    expect(await service.get(7)).toEqual({ revision: 2, items: [shortcut] });
    expect(repository.get).toHaveBeenCalledWith(7);
    repository.replace.mockResolvedValue(true);
    expect(
      await service.replace(7, {
        revision: 2,
        items: [{ ...shortcut, label: ' Chess ' }],
      }),
    ).toEqual({ revision: 3, items: [shortcut] });
    expect(repository.replace).toHaveBeenCalledWith(7, 2, [shortcut]);
  });

  it('does not overwrite changes saved on another device', async () => {
    repository.replace.mockResolvedValue(false);
    await expect(
      service.replace(7, { revision: 2, items: [shortcut] }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('supports disabling and resetting shortcuts', async () => {
    repository.replace.mockResolvedValue(true);
    expect(
      (
        await service.replace(7, {
          revision: 0,
          items: [{ ...shortcut, enabled: false }],
        })
      ).items[0].enabled,
    ).toBe(false);
    expect(await service.replace(7, { revision: 1, items: [] })).toEqual({
      revision: 2,
      items: [],
    });
  });

  it.each([-1, 0.5, '0', null, 2_000_000_000])(
    'rejects invalid revision %s before writing',
    async (revision) => {
      await expect(
        service.replace(7, { revision, items: [] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.replace).not.toHaveBeenCalled();
    },
  );

  it.each([
    'CTRL+C',
    'CTRL+SHIFT+C',
    'CTRL+SHIFT+V',
    'CTRL+SHIFT+X',
    'CTRL+SHIFT+Z',
    'ALT+F4',
    'CTRL+SHIFT+F13',
  ])('protects reserved or unsupported chord %s', (chord) => {
    expect(() => validateShortcuts([{ ...shortcut, chord }])).toThrow();
  });

  it.each(['CTRL+SHIFT+J', 'ALT+SHIFT+M', 'CTRL+SHIFT+F12', 'ALT+SHIFT+1'])(
    'accepts %s',
    (chord) => {
      expect(validateShortcuts([{ ...shortcut, chord }])[0].chord).toBe(chord);
    },
  );

  it('rejects duplicate combinations, including disabled shortcuts', () => {
    expect(() =>
      validateShortcuts([
        shortcut,
        { ...shortcut, target: 'inbox', enabled: false },
      ]),
    ).toThrow();
  });

  it.each([
    { ...shortcut, target: 'shell:execute' },
    { ...shortcut, target: 'game:../secret' },
    { ...shortcut, label: ' ' },
    { ...shortcut, label: 'a'.repeat(121) },
    { ...shortcut, enabled: 'true' },
  ])('rejects malformed preferences', async (item) => {
    await expect(
      service.replace(7, { revision: 0, items: [item] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.replace).not.toHaveBeenCalled();
  });

  it('limits the number of preferences', () => {
    expect(() =>
      validateShortcuts(Array.from({ length: 51 }, () => shortcut)),
    ).toThrow();
  });
});
