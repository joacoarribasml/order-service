export type ChargeRequest = {
  cardNumber: string;
  amountCents: number;
  description: string;
};

export type ChargeResult = { paymentId: string };

export interface PaymentClient {
  charge(request: ChargeRequest): Promise<ChargeResult>;
}

/** Stripe-style test PAN: this mock declines it so the rollback path is exercisable. */
export const DECLINED_CARD = "4000000000000002";

export class PaymentDeclinedError extends Error {
  constructor() {
    super("Payment declined");
    this.name = "PaymentDeclinedError";
  }
}

export class MockPaymentClient implements PaymentClient {
  async charge(request: ChargeRequest): Promise<ChargeResult> {
    if (request.cardNumber === DECLINED_CARD) {
      throw new PaymentDeclinedError();
    }
    return { paymentId: crypto.randomUUID() };
  }
}
