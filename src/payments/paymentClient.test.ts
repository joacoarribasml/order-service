import assert from "node:assert/strict";
import { test } from "node:test";
import { DECLINED_CARD, MockPaymentClient, PaymentDeclinedError } from "./paymentClient.js";

const charge = {
  cardNumber: "4242424242424242",
  amountCents: 425,
  description: "order",
};

test("a charge returns a payment id", async () => {
  const payments = new MockPaymentClient();
  const result = await payments.charge(charge);
  assert.equal(typeof result.paymentId, "string");
  assert.ok(result.paymentId.length > 0);
});

test("the declined card fails the charge", async () => {
  const payments = new MockPaymentClient();
  await assert.rejects(
    () => payments.charge({ ...charge, cardNumber: DECLINED_CARD }),
    PaymentDeclinedError,
  );
});
