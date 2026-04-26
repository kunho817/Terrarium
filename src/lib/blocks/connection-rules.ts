import type { BlockGraph, InputPort, OutputPort, PortType } from '$lib/types';
import { registerAllBlocks } from './registry';
import { getBlockInputPorts, getBlockOutputPorts } from './ports';

export interface PortRef {
  blockId: string;
  portId: string;
}

export interface ConnectionValidationResult {
  ok: boolean;
  reason?: string;
  sourceType?: PortType;
  targetType?: PortType;
}

interface ResolvedPort<TPort extends InputPort | OutputPort> {
  blockId: string;
  port: TPort;
}

function resolvePortFromGraph<TPort extends InputPort | OutputPort>(
  graph: BlockGraph,
  ref: PortRef,
  direction: 'input' | 'output',
): ResolvedPort<TPort> | null {
  registerAllBlocks();
  const block = graph.blocks.find((entry) => entry.id === ref.blockId);
  if (!block) {
    return null;
  }

  const ports = direction === 'input' ? getBlockInputPorts(block) : getBlockOutputPorts(block);
  const port = ports.find((entry) => entry.id === ref.portId);
  if (!port) {
    return null;
  }

  return {
    blockId: ref.blockId,
    port: port as TPort,
  };
}

export function isPortTypeCompatible(sourceType: PortType, targetType: PortType): boolean {
  if (sourceType === targetType) {
    return true;
  }

  if (targetType === 'text') {
    return true;
  }

  return false;
}

export function validateConnection(
  graph: BlockGraph,
  from: PortRef,
  to: PortRef,
): ConnectionValidationResult {
  const source = resolvePortFromGraph<OutputPort>(graph, from, 'output');
  const target = resolvePortFromGraph<InputPort>(graph, to, 'input');

  if (!source) {
    return { ok: false, reason: 'Source output port could not be found.' };
  }

  if (!target) {
    return { ok: false, reason: 'Target input port could not be found.' };
  }

  if (from.blockId === to.blockId) {
    return { ok: false, reason: 'A block cannot connect to itself.' };
  }

  if (!isPortTypeCompatible(source.port.type, target.port.type)) {
    return {
      ok: false,
      reason: `${source.port.type} cannot connect to ${target.port.type}.`,
      sourceType: source.port.type,
      targetType: target.port.type,
    };
  }

  const duplicate = graph.connections.some((connection) =>
    connection.from.blockId === from.blockId &&
    connection.from.portId === from.portId &&
    connection.to.blockId === to.blockId &&
    connection.to.portId === to.portId,
  );

  if (duplicate) {
    return {
      ok: false,
      reason: 'Those ports are already connected.',
      sourceType: source.port.type,
      targetType: target.port.type,
    };
  }

  return {
    ok: true,
    sourceType: source.port.type,
    targetType: target.port.type,
  };
}

export function describeConnectionMode(graph: BlockGraph, from: PortRef | null): string {
  if (!from) {
    return 'Drag from an output port and release on an input port.';
  }

  const source = resolvePortFromGraph<OutputPort>(graph, from, 'output');
  if (!source) {
    return 'Choose a compatible input port to finish the connection.';
  }

  const mode =
    source.port.type === 'text'
      ? 'Text outputs can connect to text inputs, and non-text values can also feed text inputs after string conversion.'
      : `${source.port.type} outputs can connect to matching inputs.`;

  return `Connecting ${source.port.name}. ${mode}`;
}
