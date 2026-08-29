export type CatalogGame = {
  id: string;
  name: string;
  status: string;
  minPlayers: number;
  maxPlayers: number;
  chatEnabled: boolean;
  chatSoundsEnabled: boolean;
  summary: string;
  engine: string;
  category: string;
  subcategory: string;
  categories: string[];
  manifestPath?: string;
  rulesPath?: string;
};

export type CategoryNode = {
  id: string;
  name: string;
  children: CategoryNode[];
};

export type FlatCategory = {
  id: string;
  name: string;
  parentId: string | null;
};
