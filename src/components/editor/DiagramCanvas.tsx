"use client";

import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ConnectionMode,
  type Edge,
  type Connection,
} from "@xyflow/react";
import { useCallback } from "react";
import "@xyflow/react/dist/style.css";
import { useEditorStore } from "@/store/editor-store";
import { useCollaborationStore } from "@/store/collaboration-store";
import { nodeTypes, edgeTypes } from "@/lib/reactflow/nodeTypes";
import { EdgeMarkers } from "./Edge/EdgeMarkers";

/** Color de cada nodo en el minimapa segun su tipo UML. */
function nodeColor(node: { type?: string }): string {
  switch (node.type) {
    case "class":
      return "#00f0ff";
    case "interface":
      return "#b9a7ff";
    case "abstract":
      return "#ffd166";
    case "enumeration":
      return "#7ee081";
    default:
      return "#849495";
  }
}

/**
 * Lienzo principal donde se dibuja el diagrama (React Flow).
 * Las relaciones se crean arrastrando desde los handles de los nodos.
 * El tipo y las propiedades se editan desde el panel lateral (PropertiesPanel).
 * Al hacer clic en el lienzo vacio se liberan los locks del usuario (CU-2.5).
 */
export function DiagramCanvas() {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const applyNodesChange = useEditorStore((s) => s.applyNodesChange);
  const applyEdgesChange = useEditorStore((s) => s.applyEdgesChange);
  const addEdge = useEditorStore((s) => s.addEdge);
  const reconnectEdge = useEditorStore((s) => s.reconnectEdge);
  const select = useEditorStore((s) => s.select);
  const releaseAllLocks = useCollaborationStore((s) => s.releaseAllLocks);

  const onConnect = useCallback(
    (params: {
      source: string;
      target: string;
      sourceHandle: string | null;
      targetHandle: string | null;
    }) => {
      addEdge(
        params.source,
        params.target,
        "association",
        params.sourceHandle ?? undefined,
        params.targetHandle ?? undefined,
      );
    },
    [addEdge],
  );

  // Al hacer clic en el lienzo vacio, libera todos los locks del usuario
  const onPaneClick = useCallback(() => {
    releaseAllLocks();
    select(null);
  }, [releaseAllLocks, select]);

  // Re-ancla una relacion arrastrando su extremo hacia otro handle (del mismo
  // nodo u otro). El store conserva la data (label y multiplicidades).
  const handleReconnect = useCallback(
    (oldEdge: Edge, connection: Connection) => {
      reconnectEdge(oldEdge.id, connection);
    },
    [reconnectEdge],
  );

  return (
    <div className="h-full w-full bg-[#eeeef0]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={applyNodesChange}
        onEdgesChange={applyEdgesChange}
        onConnect={onConnect}
        onReconnect={handleReconnect}
        reconnectRadius={18}
        onSelectionChange={(params) =>
          select(params.nodes[0]?.id ?? params.edges[0]?.id ?? null)
        }
        onPaneClick={onPaneClick}
        connectionMode={ConnectionMode.Loose}
        snapToGrid
        snapGrid={[20, 20]}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        className="h-full w-full"
      >
        <EdgeMarkers />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#8a949b"
        />
        <Controls
          className="!bg-surface-container !border-outline-variant !rounded-md !shadow-lg [&>button]:!bg-surface-container-high [&>button]:!border-outline-variant [&>button]:!text-on-surface [&>button:hover]:!bg-surface-container-highest [&>button]:!w-8 [&>button]:!h-8 [&>button]:!flex [&>button]:!items-center [&>button]:!justify-center"
          showZoom={true}
          showFitView={true}
          showInteractive={false}
        />
        <MiniMap
          nodeColor={nodeColor}
          className="!bg-surface-container"
          maskColor="rgba(17,19,23,0.7)"
        />
      </ReactFlow>
    </div>
  );
}
