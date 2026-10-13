const fs = require('node:fs');
const ts = require('../backend/node_modules/typescript');
const file = 'backend/src/modules/sounds/infrastructure/storage/sounds.service.ts';
let source = fs.readFileSync(file, 'utf8');
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
const selected = new Set(['ensureStorageCapacity', 'readManifest', 'writeManifest', 'clearSoundLocked']);
const members = ast.statements.find(n => ts.isClassDeclaration(n) && n.name.text === 'SoundsService').members;
const methods = members.filter(n => ts.isMethodDeclaration(n) && selected.has(n.name.getText(ast)));
if (methods.length !== 4) throw new Error('Expected four storage methods');
const helpers = ast.statements.filter(n => ts.isFunctionDeclaration(n) && ['environmentBytes', 'errorMessage', 'storageIoError'].includes(n.name.text));
const header = `import { BadRequestException, HttpException, InternalServerErrorException, Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readEnvironment } from '../../../../platform/config/public-api';
import { assertStorageCapacity, StorageCapacityError, writeFileAtomic } from '../../../../platform/filesystem/public-api';
import type { NotificationDispatcher } from '../../../notification/public-api';
import type { SoundManifest, SoundKey } from '../../application/read-models/sound-manifest.record';
import { buildStorageIoError, decodeSoundManifest } from './sounds-storage.utils';
import { bestEffort } from '../../../../platform/observability/public-api';

/** Manifest persistence; callers serialize mutations with the sounds directory lock. */
export class SoundsManifestStore {
  constructor(private readonly storageRoot: string, private readonly notifications: NotificationDispatcher,
    private readonly logger: Logger, private readonly normalizeSoundKey: (value: string) => SoundKey) {}
`;
let extracted = methods.map(n => n.getText(ast)).join('\n\n').replaceAll('private async', 'async')
  .replaceAll('clearSoundLocked', 'clearSound').replaceAll('normalizeSoundKey(soundIdRaw)', 'this.normalizeSoundKey(soundIdRaw)');
extracted = extracted.replace("await this.notifications.notifyAll('sounds.updated', {", "await bestEffort(this.notifications.notifyAll('sounds.updated', {")
  .replace('updatedAt: next.updatedAt,\n    });', "updatedAt: next.updatedAt,\n    }), 'notification de suppression audio');");
fs.writeFileSync(file.replace('sounds.service.ts', 'sounds-manifest.store.ts'),
  header + extracted + '\n}\n' + helpers.map(n => n.getText(ast)).join('\n\n') + '\n');
const removed = [...methods, ...helpers.filter(n => n.name.text !== 'storageIoError')].sort((a,b) => b.pos-a.pos);
for (const node of removed) source = source.slice(0,node.pos) + source.slice(node.end);
source = source.replace("import { readEnvironment } from '../../../../platform/config/public-api';", "import { SoundsManifestStore } from './sounds-manifest.store';")
  .replace('  assertStorageCapacity,\n  StorageCapacityError,\n', '')
  .replace('  HttpException,\n', '')
  .replace("import { writeFileAtomic } from '../../../../platform/filesystem/public-api';\n", '')
  .replace('  decodeSoundManifest,\n', '')
  .replace('  private readonly storageRoot: string;', '  private readonly storageRoot: string;\n  private readonly manifests: SoundsManifestStore;')
  .replace('this.storageRoot = resolveSoundsDataRoot();', 'this.storageRoot = resolveSoundsDataRoot();\n    this.manifests = new SoundsManifestStore(this.storageRoot, this.notifications, this.logger, normalizeSoundKey);')
  .replaceAll('this.readManifest()', 'this.manifests.readManifest()')
  .replaceAll('this.writeManifest(', 'this.manifests.writeManifest(')
  .replaceAll('this.ensureStorageCapacity(', 'this.manifests.ensureStorageCapacity(')
  .replaceAll('this.clearSoundLocked(', 'this.manifests.clearSound(');
fs.writeFileSync(file, source);
