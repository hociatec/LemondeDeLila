#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'contracts/asyncapi.json');
const sources = [
  'src/platform/realtime/infrastructure/presentation/ws/ws-events.ts',
  'src/modules/room/infrastructure/presentation/ws/room-ws.registrar.ts',
  'src/game/core/infrastructure/presentation/ws/game-ws.registrar.ts',
];

function eventNames(relative) {
  const file = path.join(root, relative);
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const events = [];
  const visit = (node) => {
    if (
      ts.isStringLiteralLike(node) &&
      (/ws-events\.ts$/.test(relative) ||
        (ts.isCallExpression(node.parent) &&
          node.parent.expression.getText(ast).endsWith('.register') &&
          node.parent.arguments[0] === node))
    ) {
      events.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return events;
}

const events = [...new Set(sources.flatMap(eventNames))].sort();
const contract = {
  asyncapi: '3.0.0',
  info: {
    title: 'Le Monde de Lila WebSocket API',
    version: '1.0.0',
    description:
      'Contrat canonique des événements WebSocket. Les libellés métier restent fournis par le backend.',
  },
  servers: {
    production: {
      host: 'api.lilas.hociatec.fr',
      protocol: 'wss',
    },
  },
  channels: {
    events: {
      address: '{event}',
      parameters: {
        event: { enum: events },
      },
      messages: {
        envelope: {
          payload: {
            type: 'object',
            required: ['type'],
            properties: {
              type: { type: 'string', enum: events },
              payload: {},
              requestId: { type: 'string' },
            },
            additionalProperties: true,
          },
        },
      },
    },
  },
  operations: {
    receive: {
      action: 'receive',
      channel: { $ref: '#/channels/events' },
      messages: [{ $ref: '#/channels/events/messages/envelope' }],
    },
    send: {
      action: 'send',
      channel: { $ref: '#/channels/events' },
      messages: [{ $ref: '#/channels/events/messages/envelope' }],
    },
  },
};
const serialized = `${JSON.stringify(contract, null, 2)}\n`;

if (process.argv.includes('--write')) {
  fs.writeFileSync(output, serialized, 'utf8');
  console.log(`asyncapi: ${events.length} événements écrits`);
} else if (
  !fs.existsSync(output) ||
  fs.readFileSync(output, 'utf8') !== serialized
) {
  console.error(
    'asyncapi: contrat obsolète; exécuter npm run contracts:ws:write',
  );
  process.exitCode = 1;
} else {
  console.log(`asyncapi: OK (${events.length} événements)`);
}
