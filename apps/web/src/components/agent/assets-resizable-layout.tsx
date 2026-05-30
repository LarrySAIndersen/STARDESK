"use client";

import { Suspense, type ReactNode } from "react";
import { Group, Panel, useDefaultLayout } from "react-resizable-panels";

import { ShellResizeSeparator } from "@/components/ui/shell-resize-separator";
import { useIsMdUp } from "@/hooks/use-media-query";
import { getPanelLayoutStorage } from "@/lib/panel-layout-storage";

const ASSETS_RESIZE_HIT = { fine: 12, coarse: 32 } as const;

const ASSETS_LAYOUT_STORAGE_KEY = "stardesk-assets-columns";

const PANEL_AUDIT = "audit";
const PANEL_TREE = "tree";
const PANEL_WORKSPACE = "workspace";
const PANEL_GRAPH = "graph";
const PANEL_DETAIL = "detail";

type AssetsResizableLayoutProps = {
  showAudit: boolean;
  showTree: boolean;
  showDetail: boolean;
  auditPanel: ReactNode;
  treePanel: ReactNode;
  graphPanel: ReactNode;
  detailPanel: ReactNode;
  ticketsPanel: ReactNode;
};

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
    ...(showAudit ? { [PANEL_AUDIT]: 16 } : {}),
    ...(showTree ? { [PANEL_TREE]: 18 } : {}),
    [PANEL_WORKSPACE]: showAudit && showTree ? 66 : showAudit || showTree ? 82 : 100,
  };

  const innerDefault = innerLayout ?? {
    [PANEL_GRAPH]: showDetail ? 72 : 100,
    ...(showDetail ? { [PANEL_DETAIL]: 28 } : {}),
  };

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
            defaultSize={16}
            minSize={12}
            maxSize={35}
            className="min-h-0 min-w-0"
          >
            {auditPanel}
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
            defaultSize={18}
            minSize={14}
            maxSize={40}
            className="min-h-0 min-w-0"
          >
            {treePanel}
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
