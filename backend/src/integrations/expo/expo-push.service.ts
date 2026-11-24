import { prisma } from "../../database/prisma.js";
import { env } from "../../config/env.js";
import { PaymentGatewayError } from "../../common/errors/api-error.js";

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

export interface ExpoPushReceipt {
  status: "ok" | "error";
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
    const isStrict = env.NODE_ENV === "production" || env.NODE_ENV === "staging";
    if (isStrict) {
      if (env.MOCK_INTEGRATIONS) {
        throw new Error(`Mock push service is forbidden in ${env.NODE_ENV}`);
      }
      this.isMock = false;
    } else {
      this.isMock =
        env.NODE_ENV === "test" ||
        env.MOCK_INTEGRATIONS ||
        !process.env["EXPO_ACCESS_TOKEN"];
    }
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
        if (response.status >= 500) {
          throw new PaymentGatewayError(`Expo push service returned HTTP ${response.status}`);
        }
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
    } catch (err: unknown) {
      if (err instanceof PaymentGatewayError) {
        throw err;
      }
      // Re-throw 5xx or connection failures as retryable gateway error in live environments
      if (env.NODE_ENV === "production" || env.NODE_ENV === "staging") {
        const message = err instanceof Error ? err.message : "Expo push delivery error";
        throw new PaymentGatewayError(`Expo push delivery failed: ${message}`);
      }
      return messages.map(() => ({
        status: "error",
        message: "Failed to dispatch to Expo push API",
      }));
    }
  }

  async getPushNotificationReceipts(
    receiptIds: string[]
  ): Promise<Record<string, ExpoPushReceipt>> {
    if (receiptIds.length === 0) {
      return {};
    }

    if (this.isMock) {
      const mockReceipts: Record<string, ExpoPushReceipt> = {};
      for (const id of receiptIds) {
        mockReceipts[id] = { status: "ok" };
      }
      return mockReceipts;
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

      const response = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
        method: "POST",
        headers,
        body: JSON.stringify({ ids: receiptIds }),
      });

      if (!response.ok) {
        if (response.status >= 500) {
          throw new PaymentGatewayError(`Expo receipt service returned HTTP ${response.status}`);
        }
        throw new Error(`Expo receipt service returned HTTP ${response.status}`);
      }

      const data = (await response.json()) as { data: Record<string, ExpoPushReceipt> };
      return data.data || {};
    } catch (err: unknown) {
      if (err instanceof PaymentGatewayError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : "Failed to retrieve Expo receipts";
      throw new PaymentGatewayError(`Expo receipt retrieval error: ${message}`);
    }
  }

  async processReceiptsAndDeactivateInvalid(
    receiptsWithTokens: Array<{ receiptId: string; expoPushToken: string }>
  ): Promise<{ processed: number; deactivated: number }> {
    if (receiptsWithTokens.length === 0) {
      return { processed: 0, deactivated: 0 };
    }

    const receiptIds = receiptsWithTokens.map((r) => r.receiptId);
    const receipts = await this.getPushNotificationReceipts(receiptIds);

    let deactivated = 0;
    for (const item of receiptsWithTokens) {
      const receipt = receipts[item.receiptId];
      if (receipt && receipt.status === "error" && receipt.details?.error === "DeviceNotRegistered") {
        await this.deactivateInvalidToken(item.expoPushToken);
        deactivated++;
      }
    }

    return { processed: receiptsWithTokens.length, deactivated };
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
