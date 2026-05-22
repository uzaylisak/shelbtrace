import { randomUUID } from "node:crypto";
import type { HermesAction, TaskSession } from "./types.js";

export class ActionBuffer {
  private sessions = new Map<string, TaskSession>();

  startSession(taskDescription: string): string {
    const sessionId = randomUUID();
    this.sessions.set(sessionId, {
      sessionId,
      taskDescription,
      startedAt: Date.now(),
      actions: [],
      status: "active",
    });
    return sessionId;
  }

  record(
    sessionId: string,
    action: Omit<HermesAction, "id" | "timestamp">
  ): HermesAction {
    const session = this.#requireActive(sessionId);
    const entry: HermesAction = {
      id: randomUUID(),
      timestamp: Date.now(),
      ...action,
    };
    session.actions.push(entry);
    return entry;
  }

  getSession(sessionId: string): TaskSession | undefined {
    return this.sessions.get(sessionId);
  }

  completeSession(sessionId: string): TaskSession {
    const session = this.#requireActive(sessionId);
    session.status = "completed";
    return session;
  }

  failSession(sessionId: string): TaskSession {
    const session = this.#requireActive(sessionId);
    session.status = "failed";
    return session;
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  listSessions(): { sessionId: string; taskDescription: string; startedAt: number; status: TaskSession["status"]; actionCount: number }[] {
    return [...this.sessions.values()].map(({ sessionId, taskDescription, startedAt, status, actions }) => ({
      sessionId,
      taskDescription,
      startedAt,
      status,
      actionCount: actions.length,
    }));
  }

  #requireActive(sessionId: string): TaskSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (session.status !== "active") {
      throw new Error(`Session ${sessionId} is already ${session.status}`);
    }
    return session;
  }
}
