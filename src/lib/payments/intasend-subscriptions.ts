const API_BASE = "https://api.intasend.com/api/v1";

async function intasendPost(path: string, body: Record<string, unknown>) {
  const secret = process.env.INTASEND_SECRET_KEY?.trim();
  if (!secret) throw new Error("INTASEND_NOT_CONFIGURED");
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20000)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("IntaSend subscription API failed", { path, status: response.status, detail: data?.detail ?? data?.message ?? "unknown" });
    throw new Error("INTASEND_SUBSCRIPTION_FAILED");
  }
  return data as Record<string, any>;
}

export async function createPremiumCardSubscription(input: {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  redirectUrl: string;
  reference: string;
}) {
  const customer = await intasendPost("/subscriptions-customers/", {
    email: input.email,
    first_name: input.firstName,
    last_name: input.lastName,
    country: "KE",
    reference: input.userId
  });
  const customerId = customer.customer_id;
  if (typeof customerId !== "string") throw new Error("INTASEND_CUSTOMER_MISSING");

  const plan = await intasendPost("/subscriptions-plans/", {
    name: "AJEY Premium Monthly",
    amount: 50,
    currency: "KES",
    frequency: 1,
    frequency_unit: "M",
    redirect_url: input.redirectUrl
  });
  const planId = plan.plan_id;
  if (typeof planId !== "string") throw new Error("INTASEND_PLAN_MISSING");

  const subscription = await intasendPost("/subscriptions/", {
    customer_id: customerId,
    plan_id: planId,
    reference: input.reference,
    redirect_url: input.redirectUrl
  });
  if (typeof subscription.subscription_id !== "string" || typeof subscription.setup_url !== "string") {
    throw new Error("INTASEND_SETUP_URL_MISSING");
  }
  return {
    customerId,
    subscriptionId: subscription.subscription_id,
    setupUrl: subscription.setup_url,
    status: typeof subscription.status === "string" ? subscription.status : "PENDING"
  };
}
