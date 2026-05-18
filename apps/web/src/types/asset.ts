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
