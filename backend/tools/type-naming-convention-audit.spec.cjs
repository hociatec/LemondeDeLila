const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { audit } = require('./type-naming-convention-audit.cjs');

function withFixture(files, run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'type-naming-audit-'));
  try {
    for (const [relative, source] of Object.entries(files)) {
      const target = path.join(root, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, source);
    }
    run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('accepts each canonical type category in its owned layer', () => {
  withFixture(
    {
      'modules/example/infrastructure/persistence/entities/widget.entity.ts':
        '@Entity()\nexport class Widget {}\n',
      'modules/example/application/models/widget.model.ts':
        'export type WidgetModel = { id: string };\n',
      'modules/example/application/read-models/widget.record.ts':
        'export type WidgetRecord = { id: string };\n',
      'modules/example/infrastructure/presentation/http/widget.dto.ts':
        'export class WidgetDto {}\n',
      'modules/example/application/contracts/create-widget.command.ts':
        'export type CreateWidgetCommand = { id: string };\n',
      'modules/example/application/contracts/find-widget.query.ts':
        'export type FindWidgetQuery = { id: string };\n',
      'modules/example/application/ports/widget.port.ts':
        'export interface WidgetPort {}\n',
      'modules/example/infrastructure/public/widget.adapter.ts':
        'export class WidgetAdapter {}\n',
    },
    (root) => assert.deepEqual(audit(root), []),
  );
});

test('rejects misleading suffixes at architectural boundaries', () => {
  withFixture(
    {
      'modules/example/application/widget.entity.ts':
        'export class Widget {}\n',
      'modules/example/domain/widget.record.ts':
        'export type WidgetRecord = { id: string };\n',
      'modules/example/application/widget.dto.ts':
        'export class WidgetInput {}\n',
      'modules/example/infrastructure/widget.port.ts':
        'export interface WidgetPort {}\n',
      'modules/example/application/widget.adapter.ts':
        'export class WidgetService {}\n',
    },
    (root) => {
      const violations = audit(root).join('\n');
      assert.match(violations, /Entity hors dossier entities/);
      assert.match(violations, /Entity ORM sans décorateur/);
      assert.match(violations, /Record hors dossier application\/read-models/);
      assert.match(violations, /DTO hors frontière presentation/);
      assert.match(
        violations,
        /classe de transport WidgetInput sans suffixe Dto/,
      );
      assert.match(violations, /Port hors dossier application\/ports/);
      assert.match(
        violations,
        /Adapter hors infrastructure ou app\/boundaries/,
      );
      assert.match(violations, /classe WidgetService sans suffixe Adapter/);
    },
  );
});
