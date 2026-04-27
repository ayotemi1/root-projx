import { Router } from "express";
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
    description: "Premium organic cotton tee — wear the movement.",
    price: 2500,
    currency: "gbp",
    image: null as string | null,
  },
  {
    id: "hoodie",
    name: "Root ProjX Hoodie",
    description: "Heavyweight hoodie, represent from anywhere.",
    price: 4500,
    currency: "gbp",
    image: null as string | null,
  },
  {
    id: "tote",
    name: "Root ProjX Tote Bag",
    description: "Sturdy canvas tote — carry the culture.",
    price: 1200,
    currency: "gbp",
    image: null as string | null,
  },
];

// GET /shop/products — list available products
router.get("/shop/products", (_req, res) => {
  res.json({ products: PRODUCTS });
});

// POST /shop/checkout — create Stripe Checkout session
router.post("/shop/checkout", async (req, res) => {
  try {
    const { items } = req.body as {
      items: Array<{ id: string; quantity: number }>;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "items array is required" });
      return;
    }

    const lineItems: import("stripe").Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    for (const { id, quantity } of items) {
      const product = PRODUCTS.find((p) => p.id === id);
      if (!product) {
        res.status(400).json({ error: `Unknown product: ${id}` });
        return;
      }
      if (!quantity || quantity < 1) continue;
      lineItems.push({
        price_data: {
          currency: product.currency,
          unit_amount: product.price,
          product_data: {
            name: product.name,
            description: product.description,
          },
        },
        quantity,
      });
    }

    if (lineItems.length === 0) {
      res.status(400).json({ error: "No valid items in cart" });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${DOMAIN}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${DOMAIN}/shop`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("[shop] checkout error:", err);
    res.status(500).json({ error: "Could not create checkout session" });
  }
});

// GET /shop/success — confirmation endpoint (frontend uses this path for redirect)
router.get("/shop/success", (_req, res) => {
  res.json({ status: "success" });
});

// GET /shop/cancel — cancel endpoint
router.get("/shop/cancel", (_req, res) => {
  res.json({ status: "cancelled" });
});

export default router;
