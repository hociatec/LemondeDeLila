import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { GameCategory } from './game-categories.service';

type MirrorIndexEntry = {
  id: string;
  name: string;
  parentId: string | null;
  updatedAt: string;
};

@Injectable()
export class GameCategoriesFsMirrorService {
  private readonly logger = new Logger(GameCategoriesFsMirrorService.name);
  private readonly root: string;

  constructor() {
    const envRoot = process.env.TAVERNE_CATEGORIES_ROOT;
    this.root = envRoot
      ? path.resolve(envRoot)
      : path.resolve(process.cwd(), 'data', 'taverne-categories');
  }

  async syncAll(input: {
    categories: GameCategory[];
    assignments: Record<string, string | null>;
  }): Promise<void> {
    try {
      await fs.promises.mkdir(this.root, { recursive: true });
    } catch (err) {
      this.logger.warn(
        `Impossible de créer le répertoire miroir: ${(err as Error).message}`,
      );
      return;
    }

    const categories = Array.isArray(input.categories) ? input.categories : [];
    const assignments = input.assignments ?? {};

    // 1) Upsert dossiers pour toutes les catégories
    for (const category of categories) {
      await this.upsertCategory(category, categories, assignments);
    }

    // 2) Nettoyage best-effort : supprimer les dossiers orphelins (catégorie supprimée)
    // On supprime uniquement les dossiers qui contiennent un `.category.json` avec un id inconnu.
    const known = new Set(categories.map((c) => c.id));
    await this.cleanupOrphans(known);
  }

  async deleteCategory(id: string): Promise<void> {
    const key = String(id ?? '').trim();
    if (!key) return;
    const found = await this.findFolderByCategoryId(key);
    if (!found) return;
    try {
      await fs.promises.rm(found, { recursive: true, force: true });
    } catch (err) {
      this.logger.warn(
        `Impossible de supprimer le dossier miroir (id=${key}): ${(err as Error).message}`,
      );
    }
  }

  private async upsertCategory(
    category: GameCategory,
    categories: GameCategory[],
    assignments: Record<string, string | null>,
  ): Promise<void> {
    const id = String(category?.id ?? '').trim();
    if (!id) return;

    const name = String(category?.name ?? '').trim() || id;
    const parentId =
      typeof category?.parentId === 'string' ? category.parentId.trim() : null;

    const desiredFolder = await this.resolveDesiredFolder(
      { id, name, parentId },
      categories,
    );
    if (!desiredFolder) return;

    const existingFolder = await this.findFolderByCategoryId(id);
    const folder =
      existingFolder && existingFolder !== desiredFolder
        ? await this.safeMoveFolder(existingFolder, desiredFolder, id)
        : desiredFolder;

    try {
      await fs.promises.mkdir(folder, { recursive: true });
    } catch (err) {
      this.logger.warn(
        `Impossible de créer le dossier miroir (id=${id}): ${(err as Error).message}`,
      );
      return;
    }

    const now = new Date().toISOString();
    const entry: MirrorIndexEntry = {
      id,
      name,
      parentId: parentId || null,
      updatedAt: now,
    };

    const categoryJsonPath = path.join(folder, '.category.json');
    const readmePath = path.join(folder, 'README.md');
    const gamesJsonPath = path.join(folder, 'games.json');

    const assignedGameTypes = Object.entries(assignments)
      .filter(([, categoryId]) => categoryId === id)
      .map(([gameType]) => gameType)
      .sort((a, b) => a.localeCompare(b, 'fr'));

    await this.safeWriteJson(categoryJsonPath, entry);
    await this.safeWriteText(
      readmePath,
      [
        `# ${name}`,
        '',
        `- id: \`${id}\``,
        parentId ? `- parentId: \`${parentId}\`` : `- parentId: \`null\``,
        `- syncedAt: \`${now}\``,
        '',
        'Ce dossier est un miroir automatique de la taverne.',
        'Ne pas y mettre de code: il peut être renommé/supprimé automatiquement.',
        '',
      ].join('\n'),
    );
    await this.safeWriteJson(gamesJsonPath, {
      categoryId: id,
      categoryName: name,
      games: assignedGameTypes,
    });
  }

  private async cleanupOrphans(knownIds: Set<string>): Promise<void> {
    try {
      const stack: string[] = [this.root];
      while (stack.length) {
        const current = stack.pop() as string;
        const entries = await fs.promises.readdir(current, {
          withFileTypes: true,
        });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const full = path.join(current, entry.name);
          const metaPath = path.join(full, '.category.json');
          try {
            const raw = await fs.promises.readFile(metaPath, 'utf-8');
            const parsed = GameCategoriesFsMirrorService.parseJson(
              raw.replace(/^\uFEFF/, ''),
            );
            const id = GameCategoriesFsMirrorService.getTrimmedString(
              parsed,
              'id',
            );
            if (id && !knownIds.has(id)) {
              await fs.promises.rm(full, { recursive: true, force: true });
              continue;
            }
          } catch {
            // Pas un dossier de miroir "racine" (ou pas de meta) : explorer quand même.
          }
          stack.push(full);
        }
      }
    } catch (err) {
      this.logger.debug(
        `Nettoyage orphelins miroir ignoré: ${(err as Error).message}`,
      );
    }
  }

  private async resolveDesiredFolder(
    category: { id: string; name: string; parentId: string | null },
    categories: GameCategory[],
  ): Promise<string | null> {
    const chain: Array<{ id: string; name: string }> = [];
    const visited = new Set<string>();
    let current: { id: string; name: string; parentId: string | null } | null =
      category;

    while (current) {
      if (visited.has(current.id)) break;
      visited.add(current.id);
      chain.unshift({ id: current.id, name: current.name });
      const pid = current.parentId ? current.parentId.trim() : '';
      if (!pid) break;
      const parent = categories.find((c) => c.id === pid);
      if (!parent) break;
      current = {
        id: parent.id,
        name: String(parent.name ?? '').trim() || parent.id,
        parentId: parent.parentId ?? null,
      };
    }

    if (chain.length === 0) return null;
    // IMPORTANT: les ids sont stables (recommandé). Le dossier doit donc être dérivé de l'id,
    // pas du nom affiché, pour éviter de renommer les chemins à chaque update de libellé.
    const segments = chain.map((c) => this.safeFolderName(c.id));
    let out = path.join(this.root, ...segments);

    // Collision: si un autre id a déjà pris ce chemin, on suffixe avec l'id.
    const existingMeta = await this.tryReadCategoryMeta(out);
    if (existingMeta && existingMeta.id && existingMeta.id !== category.id) {
      out = path.join(
        this.root,
        ...segments.slice(0, -1),
        `${segments.at(-1)} (${category.id})`,
      );
    }
    return out;
  }

  private async findFolderByCategoryId(id: string): Promise<string | null> {
    const key = String(id ?? '').trim();
    if (!key) return null;
    try {
      const stack: string[] = [this.root];
      while (stack.length) {
        const current = stack.pop() as string;
        if (!fs.existsSync(current)) continue;
        const entries = await fs.promises.readdir(current, {
          withFileTypes: true,
        });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const full = path.join(current, entry.name);
          const meta = await this.tryReadCategoryMeta(full);
          if (meta?.id === key) {
            return full;
          }
          stack.push(full);
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private async safeMoveFolder(
    from: string,
    to: string,
    categoryId: string,
  ): Promise<string> {
    if (!from || !to || from === to) return to;
    try {
      await fs.promises.mkdir(path.dirname(to), { recursive: true });
      if (!fs.existsSync(from)) return to;
      if (!fs.existsSync(to)) {
        await fs.promises.rename(from, to);
        return to;
      }

      // Si le target existe, suffixer.
      let attempt = 1;
      let candidate = `${to} (${attempt})`;
      while (fs.existsSync(candidate)) {
        attempt += 1;
        candidate = `${to} (${attempt})`;
      }
      await fs.promises.rename(from, candidate);
      return candidate;
    } catch (err) {
      this.logger.warn(
        `Impossible de renommer le dossier miroir (id=${categoryId}): ${(err as Error).message}`,
      );
      return from;
    }
  }

  private async tryReadCategoryMeta(
    folder: string,
  ): Promise<MirrorIndexEntry | null> {
    try {
      const metaPath = path.join(folder, '.category.json');
      const raw = await fs.promises.readFile(metaPath, 'utf-8');
      const parsed = GameCategoriesFsMirrorService.parseJson(
        raw.replace(/^\uFEFF/, ''),
      );
      const id = GameCategoriesFsMirrorService.getTrimmedString(parsed, 'id');
      if (!id) return null;
      return {
        id,
        name:
          GameCategoriesFsMirrorService.getTrimmedString(parsed, 'name') || id,
        parentId:
          GameCategoriesFsMirrorService.getTrimmedString(parsed, 'parentId') ||
          null,
        updatedAt: GameCategoriesFsMirrorService.getTrimmedString(
          parsed,
          'updatedAt',
        ),
      };
    } catch {
      return null;
    }
  }

  private safeFolderName(value: string): string {
    const raw = String(value ?? '').trim();
    const noDiacritics = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const cleaned = noDiacritics
      .replace(/[\\/]+/g, ' ')
      .replace(/[<>:"|?*\u0000-\u001F]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const noTrailing = cleaned.replace(/[. ]+$/g, '').trim();
    return noTrailing.length > 0 ? noTrailing.slice(0, 120) : 'Categorie';
  }

  private async safeWriteJson(filePath: string, data: unknown): Promise<void> {
    try {
      const tmp = `${filePath}.tmp`;
      await fs.promises.writeFile(
        tmp,
        JSON.stringify(data ?? null, null, 2) + '\n',
        'utf-8',
      );
      await fs.promises.rename(tmp, filePath);
    } catch (err) {
      this.logger.warn(
        `Ecriture JSON miroir échouée (${filePath}): ${(err as Error).message}`,
      );
    }
  }

  private async safeWriteText(filePath: string, text: string): Promise<void> {
    try {
      const tmp = `${filePath}.tmp`;
      await fs.promises.writeFile(tmp, String(text ?? ''), 'utf-8');
      await fs.promises.rename(tmp, filePath);
    } catch (err) {
      this.logger.warn(
        `Ecriture texte miroir échouée (${filePath}): ${(err as Error).message}`,
      );
    }
  }

  private static parseJson(value: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore
    }
    return {};
  }

  private static getTrimmedString(
    record: Record<string, unknown>,
    key: string,
  ): string {
    const value = record[key];
    return typeof value === 'string' ? value.trim() : '';
  }
}
