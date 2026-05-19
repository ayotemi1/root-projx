import { Router } from "express";
import { optionalAuth } from "../lib/auth.js";
import { getUncachableStripeClient } from "../lib/stripeClient.js";

const router = Router();

const DOMAIN = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : process.env.REPLIT_DEPLOYMENT === "1"
  ? `https://${process.env.REPLIT_DEPLOYMENT_DOMAIN ?? ""}`
  : "http://localhost:3000";

const PRODUCTS = [
  {
    id: "tshirt",
    name: "Root ProjX T-Shirt",
    description: "100% organic cotton. Gold logo on front, 'Restoration. Culture. Access.' on back.",
    price: 2500,
    currency: "gbp",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    emoji: "👕",
    image: null as string | null,
  },
  {
    id: "hoodie",
    name: "Root ProjX Hoodie",
    description: "Premium heavyweight hoodie. Embroidered logo. Unisex fit.",
    price: 5500,
    currency: "gbp",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    emoji: "🧥",
    image: null as string | null,
  },
  {
    id: "tote",
    name: "Root ProjX Tote",
    description: "Heavy-duty canvas tote. Gold screen-printed logo. Fits your whole world.",
    price: 1500,
    currency: "gbp",
    sizes: ["One Size"],
    emoji: "👜",
    image: null as string | null,
  },
  {
    id: "cap",
    name: "Root ProjX Cap",
    description: "5-panel structured cap. Embroidered logo. Adjustable strap.",
    price: 3000,
    currency: "gbp",
    sizes: ["One Size"],
    emoji: "🧢",
    image: null as string | null,
  },
];

// Compact serialisation for Stripe metadata — omits name/unitPricePence to stay
// well within the 500-char per-value limit even for large carts.
interface CompactItem {
  p: string; // productId
  q: number; // qty
  s: string; // size
}

function buildItemsMeta(
  items: Array<{ productId: string; qty: number; size: string }>,
): string {
  const compact: CompactItem[] = items.map(({ productId, qty, size }) => ({
    p: productId,
    q: qty,
    s: size,
  }));
  return JSON.stringify(compact);
}

// GET /shop/products — list available products
router.get("/shop/products", (_req, res) => {
  res.json({ products: PRODUCTS });
});

// ── POST /shop/checkout ───────────────────────────────────────────────────────
// Web redirect flow — creates a Stripe Checkout Session and returns { url }.
// Body: { items: { id, quantity }[] }
router.post("/shop/checkout", optionalAuth, async (req, res) => {
  try {
    const { items } = req.body as {
      items: Array<{ id?: string; productId?: string; quantity?: number; qty?: number; size?: string }>;
    };

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "items array is required and must not be empty" });
      return;
    }

    const lineItems: import("stripe").Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    const itemsMeta: Array<{ productId: string; qty: number; size: string }> = [];

    for (const item of items) {
      const productId = (item.id ?? item.productId ?? "").toString();
      const product = PRODUCTS.find((p) => p.id === productId);
      if (!product) {
        res.status(400).json({ error: `Product not found: ${productId}` });
        return;
      }
      const quantity = Math.max(1, Math.floor(Number(item.quantity ?? item.qty ?? 1)));
      lineItems.push({
        price_data: {
          currency: product.currency,
          unit_amount: product.price,
          product_data: { name: product.name, description: product.description },
        },
        quantity,
      });
      itemsMeta.push({ productId: product.id, qty: quantity, size: item.size ?? "One Size" });
    }

    const uid = req.user?.userId;
    const stripe = await getUncachableStripeClient();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      payment_intent_data: {
        metadata: {
          type: "shop_order",
          ...(uid ? { userId: uid } : {}),
          itemCount: String(itemsMeta.length),
          itemsJson: buildItemsMeta(itemsMeta),
        },
      },
      success_url: `${DOMAIN}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${DOMAIN}/shop`,
    });

    req.log.info({ sessionId: session.id, uid: uid ?? "guest" }, "Shop checkout session created");
    res.json({ url: session.url });
  } catch (err) {
    req.log.error({ err }, "POST /shop/checkout error");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// ── POST /shop/payment-intent ─────────────────────────────────────────────────
// Mobile payment-sheet flow — creates a Stripe PaymentIntent and returns
// { clientSecret, paymentIntentId, amountGbp }.
// Body: { items: { id | productId, qty, size? }[] }
router.post("/shop/payment-intent", optionalAuth, async (req, res) => {
  try {
    const { items } = req.body as {
      items: Array<{ id?: string; productId?: string; qty?: number; size?: string }>;
    };

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "items array is required and must not be empty" });
      return;
    }

    let totalPence = 0;
    const itemsMeta: Array<{ productId: string; qty: number; size: string }> = [];

    for (const item of items) {
      const productId = (item.id ?? item.productId ?? "").toString();
      const product = PRODUCTS.find((p) => p.id === productId);
      if (!product) {
        res.status(400).json({ error: `Product not found: ${productId}` });
        return;
      }
      const qty = Math.max(1, Math.floor(Number(item.qty ?? 1)));
      totalPence += product.price * qty;
      itemsMeta.push({ productId: product.id, qty, size: item.size ?? "One Size" });
    }

    if (totalPence < 50) {
      res.status(400).json({ error: "Order total is too low (minimum 50p)" });
      return;
    }

    const uid = req.user?.userId;
    const stripe = await getUncachableStripeClient();

    const intent = await stripe.paymentIntents.create({
      amount: totalPence,
      currency: "gbp",
      automatic_payment_methods: { enabled: true },
      metadata: {
        type: "shop_order",
        ...(uid ? { userId: uid } : {}),
        itemCount: String(itemsMeta.length),
        itemsJson: buildItemsMeta(itemsMeta),
      },
    });

    req.log.info(
      { paymentIntentId: intent.id, totalPence, uid: uid ?? "guest" },
      "Shop payment intent created",
    );

    res.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amountGbp: totalPence / 100,
    });
  } catch (err) {
    req.log.error({ err }, "POST /shop/payment-intent error");
    res.status(500).json({ error: "Failed to create payment intent" });
  }
});

// GET /shop/success — stub for redirect confirmation pages
router.get("/shop/success", (_req, res) => {
  res.json({ status: "success" });
});

// GET /shop/cancel — stub
router.get("/shop/cancel", (_req, res) => {
  res.json({ status: "cancelled" });
});

export default router;
