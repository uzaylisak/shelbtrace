import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { z } from "zod";
import type { ActionBuffer } from "./buffer.js";
import type { ShelbyWriter } from "./shelby-client.js";

export function registerTools(
  server: Server,
  buffer: ActionBuffer,
  shelby: ShelbyWriter
): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;

    switch (name) {
      case "session_start": {
        const { task_description } = z
          .object({ task_description: z.string() })
          .parse(args);
        const sessionId = buffer.startSession(task_description);
        return text(`Session started. session_id: ${sessionId}`);
      }

      case "action_record": {
        const parsed = z
          .object({
            session_id: z.string(),
            type: z.string(),
            tool: z.string().optional(),
            input: z.unknown().optional(),
            output: z.unknown().optional(),
            error: z.string().optional(),
            duration_ms: z.number().optional(),
            metadata: z.record(z.unknown()).optional(),
          })
          .parse(args);

        const action = buffer.record(parsed.session_id, {
          type: parsed.type,
          tool: parsed.tool,
          input: parsed.input,
          output: parsed.output,
          error: parsed.error,
          durationMs: parsed.duration_ms,
          metadata: parsed.metadata,
        });
        return text(`Action recorded. action_id: ${action.id}`);
      }

      case "session_flush": {
        const { session_id } = z
          .object({ session_id: z.string() })
          .parse(args);

        const session = buffer.completeSession(session_id);
        const result = await shelby.flush(session);
        buffer.deleteSession(session_id);

        return text(
          JSON.stringify({
            blob_ref: result.blobRef,
            session_id: result.sessionId,
            action_count: result.actionCount,
            uploaded_at: new Date(result.uploadedAt).toISOString(),
          })
        );
      }

      case "session_fail": {
        const { session_id } = z
          .object({ session_id: z.string() })
          .parse(args);

        const session = buffer.failSession(session_id);
        const result = await shelby.flush(session);
        buffer.deleteSession(session_id);

        return text(
          JSON.stringify({
            blob_ref: result.blobRef,
            session_id: result.sessionId,
            action_count: result.actionCount,
            status: "failed",
            uploaded_at: new Date(result.uploadedAt).toISOString(),
          })
        );
      }

      case "session_list": {
        const sessions = buffer.listSessions();
        return text(JSON.stringify(sessions));
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });
}

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

const TOOL_DEFINITIONS = [
  {
    name: "session_start",
    description: "Start a new buffered task session for a Hermes Agent run.",
    inputSchema: {
      type: "object",
      properties: {
        task_description: {
          type: "string",
          description: "Human-readable description of the task being performed.",
        },
      },
      required: ["task_description"],
    },
  },
  {
    name: "action_record",
    description: "Append a single agent action to the active session buffer.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        type: {
          type: "string",
          description: "Action category (e.g. tool_call, llm_response, decision).",
        },
        tool: { type: "string", description: "Tool name if applicable." },
        input: { description: "Tool input or prompt." },
        output: { description: "Tool output or model response." },
        error: { type: "string", description: "Error message if the action failed." },
        duration_ms: { type: "number" },
        metadata: { type: "object" },
      },
      required: ["session_id", "type"],
    },
  },
  {
    name: "session_flush",
    description:
      "Mark task as completed, write all buffered actions as a single blob to Shelby, and clear the session.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
      },
      required: ["session_id"],
    },
  },
  {
    name: "session_fail",
    description:
      "Mark task as failed, write all buffered actions as a single blob to Shelby, and clear the session.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
      },
      required: ["session_id"],
    },
  },
  {
    name: "session_list",
    description: "List all active sessions with their action counts.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];
