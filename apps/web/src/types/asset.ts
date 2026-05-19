/** CMDB-style asset hierarchy (integration-ready IDs). */

export interface AssetSubsystem {
  id: string;
  system_id: string;
  name: string;
  code: string;
}

export interface AssetSystem {
  id: string;
  name: string;
  code: string;
  subsystems: AssetSubsystem[];
}

export type AssetSelection =
  | { kind: "system"; system: AssetSystem }
  | { kind: "subsystem"; system: AssetSystem; subsystem: AssetSubsystem };

/** CMDB detail fields shown in the asset drawer (Danish labels in UI). */
export type AssetStatus = "I drift" | "Planlagt" | "Nedlagt";
export type AssetEnvironment = "Produktion" | "Test";
export type AssetKind = "system" | "undersystem";

export interface AssetDetail {
  id: string;
  name: string;
  code: string;
  kind: AssetKind;
  status: AssetStatus;
  ownerTeam: string;
  environment: AssetEnvironment;
  parentSystemId: string | null;
  parentSystemName: string | null;
  description: string;
  relatedAssetIds: string[];
  lastUpdated: string;
}

export interface AssetGraphNode {
  id: string;
  label: string;
  kind: AssetKind;
  x: number;
  y: number;
  radius: number;
}

export interface AssetGraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface AssetGraphData {
  nodes: AssetGraphNode[];
  edges: AssetGraphEdge[];
}
