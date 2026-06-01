import type { UIMessage } from 'ai';

type MessagePart = UIMessage['parts'][number];

function isToolPart(
  part: MessagePart,
): part is MessagePart & { type: string; state?: string } {
  return part.type.startsWith('tool-');
}

/** Một card tool mỗi loại / message — tránh 2 ticket hoặc 2 khối gợi ý. */
export function dedupeToolPartsForRender(parts: MessagePart[]): MessagePart[] {
  const outputByTool = new Map<string, MessagePart>();

  for (const part of parts) {
    if (!isToolPart(part)) continue;
    if (part.state !== 'output-available' || !('output' in part)) continue;
    if (!outputByTool.has(part.type)) {
      outputByTool.set(part.type, part);
    }
  }

  const renderedTools = new Set<string>();
  const result: MessagePart[] = [];

  for (const part of parts) {
    if (part.type === 'text') {
      result.push(part);
      continue;
    }

    if (!isToolPart(part)) continue;

    const toolType = part.type;

    if (part.state === 'input-available' || part.state === 'input-streaming') {
      if (outputByTool.has(toolType)) continue;
      if (renderedTools.has(toolType)) continue;
      renderedTools.add(toolType);
      result.push(part);
      continue;
    }

    if (part.state === 'output-available') {
      if (renderedTools.has(toolType)) continue;
      if (outputByTool.get(toolType) !== part) continue;
      renderedTools.add(toolType);
      result.push(part);
    }
  }

  return result;
}
