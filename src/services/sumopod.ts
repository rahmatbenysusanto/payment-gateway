export interface SumopodWebhookPayload {
  event_type: "payment.completed" | "payment.failed" | "payment.expired" | "payment.test";
  data: {
    payment_id: string;
    order_id: string;
    amount: number;
    fee: number;
    net_amount: number;
    status: string;
    payment_method: string;
    completed_at?: string;
  };
}

interface SumopodCreatePaymentRequest {
  orderId: string;
  amount: number;
  currency: string;
  expiresInHours?: number;
  successReturnUrl?: string;
  cancelReturnUrl?: string;
}

// Sesuai response aktual dari Sumopod API
interface SumopodRawResponse {
  payment_id: string;
  order_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  payment_link_url: string;
  payment_code: string;
  payment_code_type: string;
  payment_channel_used: string;
  status: string;
  expires_at: string;
}

export interface SumopodPaymentResponse {
  paymentId: string;
  orderId: string;
  amount: number;
  fee: number;
  netAmount: number;
  paymentLinkUrl: string;
  paymentCode: string;
  paymentCodeType: string;
  paymentChannel: string;
  status: string;
  expiresAt: string;
  raw: SumopodRawResponse;
}

export interface SumopodStatusResponse {
  paymentId: string;
  orderId: string;
  status: string;
  amount: number;
  paidAt?: string;
  raw: Record<string, unknown>;
}

export class SumopodService {
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.apiUrl =
      process.env.SUMOPOD_API_URL ||
      "https://api-pay-sandbox.sumopod.com";
    this.apiKey = process.env.SUMOPOD_API_KEY || "";

    if (!this.apiKey) {
      console.warn("[Sumopod] SUMOPOD_API_KEY not configured");
    }
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.apiUrl}${endpoint}`;

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Sumopod error ${res.status}: ${err}`);
    }

    return res.json() as Promise<T>;
  }

  async createPayment(
    data: SumopodCreatePaymentRequest
  ): Promise<SumopodPaymentResponse> {
    const payload = {
      order_id: data.orderId,
      amount: data.amount,
      currency: data.currency,
      expires_in_hours: data.expiresInHours ?? 24,
      success_return_url: data.successReturnUrl,
      cancel_return_url: data.cancelReturnUrl,
      payment_method_type_code: "QRIS",
    };

    const raw = await this.request<SumopodRawResponse>(
      "POST",
      "/api/v1/payments",
      payload
    );

    return {
      paymentId: raw.payment_id,
      orderId: raw.order_id,
      amount: raw.amount,
      fee: raw.fee,
      netAmount: raw.net_amount,
      paymentLinkUrl: raw.payment_link_url,
      paymentCode: raw.payment_code,
      paymentCodeType: raw.payment_code_type,
      paymentChannel: raw.payment_channel_used,
      status: raw.status,
      expiresAt: raw.expires_at,
      raw,
    };
  }

  async getPaymentStatus(paymentId: string): Promise<SumopodStatusResponse> {
    const raw = await this.request<Record<string, unknown>>(
      "GET",
      `/api/v1/payments/${paymentId}`
    );

    return {
      paymentId: raw.payment_id as string,
      orderId: raw.order_id as string,
      status: raw.status as string,
      amount: raw.amount as number,
      paidAt: raw.paid_at as string | undefined,
      raw,
    };
  }

  mapStatus(
    gatewayStatus: string
  ): "pending" | "processing" | "paid" | "failed" | "expired" | "refunded" | "cancelled" {
    const map: Record<string, "pending" | "processing" | "paid" | "failed" | "expired" | "refunded" | "cancelled"> = {
      PENDING: "pending",
      WAITING: "pending",
      PROCESS: "processing",
      PROCESSING: "processing",
      SUCCESS: "paid",
      PAID: "paid",
      COMPLETED: "paid",
      FAILED: "failed",
      EXPIRED: "expired",
      REFUNDED: "refunded",
      CANCELLED: "cancelled",
      CANCELED: "cancelled",
    };
    return map[gatewayStatus.toUpperCase()] ?? "pending";
  }

  // Mapping dari event_type webhook ke status transaksi kita
  mapEventType(
    eventType: string
  ): "pending" | "processing" | "paid" | "failed" | "expired" | "refunded" | "cancelled" | null {
    const map: Record<string, "pending" | "processing" | "paid" | "failed" | "expired" | "refunded" | "cancelled" | null> = {
      "payment.completed": "paid",
      "payment.failed": "failed",
      "payment.expired": "expired",
      "payment.test": null, // event test, tidak update status
    };
    return map[eventType] ?? null;
  }
}

export const sumopodService = new SumopodService();
