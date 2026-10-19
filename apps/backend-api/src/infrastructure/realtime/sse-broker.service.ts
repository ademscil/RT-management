import type { FastifyReply } from 'fastify';
import type { SSEEventData } from '@simrt/shared-types';

export class SSEBrokerService {
  // Map of userId -> Set of active SSE response connections
  private clients = new Map<string, Set<FastifyReply>>();
  // Map of role -> Set of userIds
  private userRoles = new Map<string, string>();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeat();
  }

  /**
   * Register a client SSE connection
   */
  public registerClient(userId: string, role: string, reply: FastifyReply): void {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId)!.add(reply);
    this.userRoles.set(userId, role);

    // Initial greeting / connection established
    reply.raw.write(
      `event: system\ndata: ${JSON.stringify({ status: 'connected', time: new Date().toISOString() })}\n\n`
    );

    // On connection close, clean up to prevent memory leaks
    reply.raw.on('close', () => {
      this.unregisterClient(userId, reply);
    });
  }

  /**
   * Unregister client connection
   */
  public unregisterClient(userId: string, reply: FastifyReply): void {
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.delete(reply);
      if (userClients.size === 0) {
        this.clients.delete(userId);
        this.userRoles.delete(userId);
      }
    }
  }

  /**
   * Send real-time SSE event to a specific user
   */
  public emitToUser(userId: string, event: string, data: SSEEventData | unknown): boolean {
    const userClients = this.clients.get(userId);
    if (!userClients || userClients.size === 0) {
      return false;
    }

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of userClients) {
      try {
        client.raw.write(payload);
      } catch {
        // Socket error, will be cleaned up on close event
      }
    }
    return true;
  }

  /**
   * Send real-time event to all users having a specific role (e.g. KETUA_RT, SEKRETARIS, BENDAHARA)
   */
  public emitToRole(targetRole: string, event: string, data: SSEEventData | unknown): number {
    let sentCount = 0;
    for (const [userId, role] of this.userRoles.entries()) {
      if (role === targetRole || (targetRole === 'PENGURUS' && role !== 'WARGA')) {
        if (this.emitToUser(userId, event, data)) {
          sentCount++;
        }
      }
    }
    return sentCount;
  }

  /**
   * Broadcast real-time event to all connected users
   */
  public broadcast(event: string, data: SSEEventData | unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const userClients of this.clients.values()) {
      for (const client of userClients) {
        try {
          client.raw.write(payload);
        } catch {
          // Socket error
        }
      }
    }
  }

  /**
   * Periodic 25-second heartbeat to keep SSE connections alive across proxies (Caddy/Nginx)
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const ping = `event: heartbeat\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`;
      for (const userClients of this.clients.values()) {
        for (const client of userClients) {
          try {
            client.raw.write(ping);
          } catch {
            // Ignored
          }
        }
      }
    }, 25000);
  }

  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }
}
