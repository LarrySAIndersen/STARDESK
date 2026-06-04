"use client";

import { type ReactNode, useCallback, useMemo, useState } from "react";
import { Group, Panel, useDefaultLayout, usePanelRef } from "react-resizable-panels";

import { AssetColumnEdgeExpand } from "@/components/agent/asset-column-edge-expand";
import { ShellResizeSeparator } from "@/components/ui/shell-resize-separator";
import { useIsMdUp } from "@/hooks/use-media-query";
import { useAssetPanelNarrow, useSyncAssetPanels } from "@/hooks/use-sync-asset-panels";
import { ASSETS_AUDIT, ASSETS_TREE } from "@/lib/assets-layout";
import { getPanelLayoutStorage } from "@/lib/panel-layout-storage";

const ASSETS_RESIZE_HIT = { fine: 12, coarse: 32 } as const;

const ASSETS_LAYOUT_STORAGE_KEY = "stardesk-assets-columns-v2";

const PANEL_AUDIT = "audit";
const PANEL_TREE = "tree";
const PANEL_WORKSPACE = "workspace";
const PANEL_GRAPH = "graph";
const PANEL_DETAIL = "detail";

type AssetsResizableLayoutProps = Readonly<{
  showAudit: boolean;
  showTree: boolean;
  showDetail: boolean;
  auditPanel: ReactNode;
  treePanel: ReactNode;
  graphPanel: ReactNode;
  detailPanel: ReactNode;
  ticketsPanel: ReactNode;
}>;

function AssetPanelShell({
  children,
  narrow,
  onExpand,
  expandLabel,
}: {
  children: ReactNode;
  narrow: boolean;
  onExpand: () => void;
  expandLabel: string;
}) {
  return (
    <div className="relative h-full min-h-0 min-w-0">
      {children}
      {narrow ? <AssetColumnEdgeExpand onExpand={onExpand} label={expandLabel} /> : null}
    </div>
  );
}

export function AssetsResizableLayout({
  showAudit,
  showTree,
  showDetail,
  auditPanel,
  treePanel,
  graphPanel,
  detailPanel,
  ticketsPanel,
}: AssetsResizableLayoutProps) {
  const isMdUp = useIsMdUp();
  const auditPanelRef = usePanelRef();
  const treePanelRef = usePanelRef();

  const [auditWidthPx, setAuditWidthPx] = useState<number | null>(null);
  const [treeWidthPx, setTreeWidthPx] = useState<number | null>(null);

  const outerPanelIds = [
    ...(showAudit ? [PANEL_AUDIT] : []),
    ...(showTree ? [PANEL_TREE] : []),
    PANEL_WORKSPACE,
  ];

  const outerLayoutKey = `${ASSETS_LAYOUT_STORAGE_KEY}-outer-${showAudit ? "a" : ""}${showTree ? "t" : ""}w`;

  const { defaultLayout: outerLayout, onLayoutChanged: onOuterLayoutChanged } = useDefaultLayout({
    id: outerLayoutKey,
    panelIds: outerPanelIds,
    storage: getPanelLayoutStorage(),
  });

  const innerPanelIds = showDetail ? [PANEL_GRAPH, PANEL_DETAIL] : [PANEL_GRAPH];

  const innerLayoutKey = `${ASSETS_LAYOUT_STORAGE_KEY}-inner-${showDetail ? "d" : "g"}`;

  const { defaultLayout: innerLayout, onLayoutChanged: onInnerLayoutChanged } = useDefaultLayout({
    id: innerLayoutKey,
    panelIds: innerPanelIds,
    storage: getPanelLayoutStorage(),
  });

  const outerDefault = outerLayout ?? {
    ...(showAudit ? { [PANEL_AUDIT]: ASSETS_AUDIT.default } : {}),
    ...(showTree ? { [PANEL_TREE]: ASSETS_TREE.default } : {}),
    [PANEL_WORKSPACE]: showAudit && showTree ? 66 : showAudit || showTree ? 82 : 100,
  };

  const innerDefault = innerLayout ?? {
    [PANEL_GRAPH]: showDetail ? 72 : 100,
    ...(showDetail ? { [PANEL_DETAIL]: 28 } : {}),
  };

  const syncTargets = useMemo(
    () => [
      {
        ref: auditPanelRef,
        enabled: showAudit && isMdUp,
        defaultWidthPx: ASSETS_AUDIT.default,
        narrowThresholdPx: ASSETS_AUDIT.narrow,
      },
      {
        ref: treePanelRef,
        enabled: showTree && isMdUp,
        defaultWidthPx: ASSETS_TREE.default,
        narrowThresholdPx: ASSETS_TREE.narrow,
      },
    ],
    [auditPanelRef, isMdUp, showAudit, showTree, treePanelRef],
  );

  useSyncAssetPanels(syncTargets);

  const auditNarrow = useAssetPanelNarrow(auditWidthPx, ASSETS_AUDIT.narrow);
  const treeNarrow = useAssetPanelNarrow(treeWidthPx, ASSETS_TREE.narrow);

  const expandAudit = useCallback(() => {
    auditPanelRef.current?.resize(ASSETS_AUDIT.default);
  }, [auditPanelRef]);

  const expandTree = useCallback(() => {
    treePanelRef.current?.resize(ASSETS_TREE.default);
  }, [treePanelRef]);

  if (!isMdUp) {
    return (
      <div className="wire-assets-layout flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        <p className="text-muted-foreground rounded-sm border border-dashed border-[var(--gray-border)] px-3 py-2 text-[11px]">
          Bredde på kolonner kan justeres fra 768px skærmbredde. Zoom ud eller brug en bredere
          skærm for at trække mellem ændringslog, liste og kort.
        </p>
        {showAudit ? <div className="shrink-0">{auditPanel}</div> : null}
        {showTree ? <div className="shrink-0">{treePanel}</div> : null}
        <div className="wire-assets-card wire-assets-card--graph flex min-h-[min(60vh,520px)] min-w-0 flex-col overflow-hidden">
          {graphPanel}
          {detailPanel}
          {ticketsPanel}
        </div>
      </div>
    );
  }

  return (
    <Group
      key={outerLayoutKey}
      id={outerLayoutKey}
      orientation="horizontal"
      className="wire-assets-layout h-full min-h-0 min-w-0 w-full flex-1"
      defaultLayout={outerDefault}
      onLayoutChanged={onOuterLayoutChanged}
      resizeTargetMinimumSize={ASSETS_RESIZE_HIT}
    >
      {showAudit ? (
        <>
          <Panel
            id={PANEL_AUDIT}
            panelRef={auditPanelRef}
            defaultSize={ASSETS_AUDIT.default}
            minSize={ASSETS_AUDIT.min}
            maxSize={ASSETS_AUDIT.max}
            groupResizeBehavior="preserve-pixel-size"
            className="min-h-0 min-w-0"
            onResize={(size) => setAuditWidthPx(size.inPixels)}
          >
            <AssetPanelShell
              narrow={auditNarrow}
              onExpand={expandAudit}
              expandLabel="Udvid ændringslog"
            >
              {auditPanel}
            </AssetPanelShell>
          </Panel>
          <ShellResizeSeparator
            id={`${outerLayoutKey}-sep-audit`}
            label="Træk for at ændre bredde på ændringslog"
          />
        </>
      ) : null}

      {showTree ? (
        <>
          <Panel
            id={PANEL_TREE}
            panelRef={treePanelRef}
            defaultSize={ASSETS_TREE.default}
            minSize={ASSETS_TREE.min}
            maxSize={ASSETS_TREE.max}
            groupResizeBehavior="preserve-pixel-size"
            className="min-h-0 min-w-0"
            onResize={(size) => setTreeWidthPx(size.inPixels)}
          >
            <AssetPanelShell
              narrow={treeNarrow}
              onExpand={expandTree}
              expandLabel="Udvid aktivliste"
            >
              {treePanel}
            </AssetPanelShell>
          </Panel>
          <ShellResizeSeparator
            id={`${outerLayoutKey}-sep-tree`}
            label="Træk for at ændre bredde på aktivliste"
          />
        </>
      ) : null}

      <Panel
        id={PANEL_WORKSPACE}
        defaultSize={66}
        minSize={30}
        className="min-h-0 min-w-0"
      >
        <Group
          key={innerLayoutKey}
          id={innerLayoutKey}
          orientation="horizontal"
          className="wire-assets-card wire-assets-card--graph wire-assets-graph-row h-full min-h-0 min-w-0 flex-1 overflow-hidden"
          defaultLayout={innerDefault}
          onLayoutChanged={onInnerLayoutChanged}
          resizeTargetMinimumSize={ASSETS_RESIZE_HIT}
        >
          <Panel id={PANEL_GRAPH} defaultSize={72} minSize={35} className="min-h-0 min-w-0">
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
              {graphPanel}
              {ticketsPanel}
            </div>
          </Panel>
          {showDetail ? (
            <>
              <ShellResizeSeparator
                id={`${innerLayoutKey}-sep-detail`}
                label="Træk for at ændre bredde på detaljer"
              />
              <Panel
                id={PANEL_DETAIL}
                defaultSize={28}
                minSize={18}
                maxSize={45}
                className="min-h-0 min-w-0 overflow-hidden border-l border-[var(--gray-border)]"
              >
                {detailPanel}
              </Panel>
            </>
          ) : null}
        </Group>
      </Panel>
    </Group>
  );
}
