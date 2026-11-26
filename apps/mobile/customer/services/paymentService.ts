import { api } from "./api";

export interface InitializePaymentRequestDto {
  orderId: string;
  callbackUrl?: string;
}

export interface InitializePaymentResponseDto {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
  orderId: string;
  amountMinor: number;
  amountFormatted: string;
}

export interface VerifyPaymentResponseDto {
  orderId: string;
  reference: string;
  status: "PENDING" | "SUCCESS" | "FAILED" | "ABANDONED";
  paidAt?: string | null;
  amountMinor: number;
  requiresReconciliation?: boolean;
  reconciliationReason?: string | null;
}

export const paymentService = {
  async initialize(payload: InitializePaymentRequestDto): Promise<InitializePaymentResponseDto> {
    const { data } = await api.post<InitializePaymentResponseDto>("/payments/initialize", payload);
    return data;
  },

  async verify(reference: string): Promise<VerifyPaymentResponseDto> {
    const { data } = await api.get<VerifyPaymentResponseDto>(`/payments/verify/${reference}`);
    return data;
  },
};
