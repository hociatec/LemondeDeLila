/** Application-owned catalogue; existing game JSON keeps its wire format. */
import { createJsonGameCompiler } from '../engine/sdk/extension-api';
import type { JsonGameCoreDocument } from '../engine/sdk/extension-api';

type NativePatternViews = {
  propertyEconomy: {
    buildings: Record<
      string,
      { houses: number; hotel: boolean; mortgaged: boolean }
    >;
  };
};
export type JsonGameViews = NativePatternViews;
export type JsonGameView = Partial<NativePatternViews['propertyEconomy']>;

const compiler = createJsonGameCompiler();
export type JsonGameDocument = JsonGameCoreDocument;
export const compileJsonGame = compiler.compileJsonGame;
export const jsonGameSchema = compiler.jsonGameSchema;
export const parseJsonGame = (
  value: unknown,
  path?: string,
): JsonGameDocument => compiler.parseJsonGame(value, path);
export { resolveJsonContent } from '../engine/sdk/extension-api';
export type { JsonContentAssets } from '../engine/sdk/extension-api';
export type { JsonGameManifest } from '../engine/sdk/extension-api';
export { effectJsonSchema } from '../engine/sdk/extension-api';
