import { prisma } from "../../database/prisma.js";
import { env } from "../../config/env.js";

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown> | undefined;
  sound?: "default" | undefined;
}

export interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: {
    error?: "DeviceNotRegistered" | "InvalidCredentials" | "MessageTooBig" | "MessageRateExceeded";
  };
}

export function isExpoPushToken(token: string): boolean {
  if (typeof token !== "string") return false;
  return (
    token.startsWith("ExponentPushToken[") ||
    token.startsWith("ExpoPushToken[") ||
    /^[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}$/i.test(token)
  );
}

export class ExpoPushService {
  private isMock: boolean;

  constructor() {
    this.isMock =
      env.NODE_ENV === "test" ||
      Boolean(env.MOCK_INTEGRATIONS) ||
      !process.env["EXPO_ACCESS_TOKEN"];
  }

  async sendPushNotifications(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    if (messages.length === 0) {
      return [];
    }

    if (this.isMock) {
      return messages.map((m, index) => ({
        status: "ok",
        id: `mock_ticket_${index}_${Date.now()}`,
      }));
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      const token = process.env["EXPO_ACCESS_TOKEN"];
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers,
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        throw new Error(`Expo push service returned HTTP ${response.status}`);
      }

      const data = (await response.json()) as { data: ExpoPushTicket[] };
      const tickets = data.data || [];

      // Process tickets: automatically deactivate unregistered tokens
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        const msg = messages[i];
        if (ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered" && msg) {
          await this.deactivateInvalidToken(msg.to);
        }
      }

      return tickets;
    } catch {
      // In live environment, log error but do not throw to protect worker execution
      return messages.map(() => ({
        status: "error",
        message: "Failed to dispatch to Expo push API",
      }));
    }
  }

  async deactivateInvalidToken(expoPushToken: string): Promise<void> {
    try {
      await prisma.userDevice.updateMany({
        where: { expoPushToken },
        data: { isActive: false },
      });
    } catch {
      // Safe no-op on database conflict
    }
  }
}

export const expoPushService = new ExpoPushService();
