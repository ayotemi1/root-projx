import { useState } from "react";
import { ShoppingBag, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/context/CartContext";
import * as api from "@/lib/api";

const PRODUCTS: api.ShopProduct[] = [
  { id: "tshirt", name: "Root ProjX T-Shirt", description: "Premium organic cotton tee — wear the movement. Available in S–XXL.", price: 2500, currency: "gbp" },
  { id: "hoodie", name: "Root ProjX Hoodie", description: "Heavyweight hoodie, represent from anywhere. Classic fit, unisex.", price: 4500, currency: "gbp" },
  { id: "tote", name: "Root ProjX Tote Bag", description: "Sturdy canvas tote — carry the culture. 100% recycled cotton canvas.", price: 1200, currency: "gbp" },
];

function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function ProductCard({ product }: { product: api.ShopProduct }) {
  const { cart, addItem, removeItem, updateQuantity } = useCart();
  const item = cart.find((i) => i.id === product.id);
  const qty = item?.quantity ?? 0;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col">
      {/* Product image placeholder */}
      <div className="w-full aspect-square bg-secondary/60 flex flex-col items-center justify-center gap-2">
        <ShoppingBag className="w-12 h-12 text-muted-foreground/40" />
        <span className="text-xs text-muted-foreground italic">Product photo coming soon</span>
      </div>

      <div className="p-5 flex flex-col flex-1 gap-3">
        <div>
          <h3 className="font-bold text-foreground text-base">{product.name}</h3>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{product.description}</p>
        </div>
        <div className="mt-auto">
          <p className="text-xl font-extrabold text-primary mb-3">{formatPrice(product.price)}</p>

          {qty === 0 ? (
            <Button onClick={() => addItem(product.id)} className="w-full">
              Add to cart
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(product.id, qty - 1)}
                className="w-8 h-8 rounded-md border border-border flex items-center justify-center hover:bg-secondary transition-colors"
              >
                {qty === 1 ? <Trash2 className="w-4 h-4 text-destructive" /> : <Minus className="w-4 h-4" />}
              </button>
              <span className="font-bold text-foreground w-6 text-center">{qty}</span>
              <button
                onClick={() => addItem(product.id)}
                className="w-8 h-8 rounded-md border border-border flex items-center justify-center hover:bg-secondary transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => removeItem(product.id)}
                className="ml-auto text-xs text-destructive hover:underline"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShopPage() {
  const { cart, totalItems, clearCart } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const cartTotal = cart.reduce((sum, item) => {
    const product = PRODUCTS.find((p) => p.id === item.id);
    return sum + (product?.price ?? 0) * item.quantity;
  }, 0);

  async function handleCheckout() {
    if (cart.length === 0) return;
    setCheckingOut(true);
    setCheckoutError("");
    try {
      const { url } = await api.createShopCheckout(cart);
      if (url) {
        window.location.href = url;
      }
    } catch (err: unknown) {
      setCheckoutError(err instanceof Error ? err.message : "Checkout failed. Please try again.");
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-foreground flex items-center gap-3">
          <ShoppingBag className="w-8 h-8 text-primary" />
          Merch Shop
        </h1>
        <p className="text-muted-foreground mt-1">
          Wear the movement. All proceeds support grassroots organisations through Root ProjX.
        </p>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {PRODUCTS.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

      {/* Cart summary */}
      {totalItems > 0 && (
        <div className="sticky bottom-4 bg-card border border-border rounded-2xl shadow-lg p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <p className="font-bold text-foreground">
              {totalItems} {totalItems === 1 ? "item" : "items"} in your cart
            </p>
            <p className="text-sm text-muted-foreground">
              Total: <span className="font-bold text-foreground">{formatPrice(cartTotal)}</span>
            </p>
            {checkoutError && (
              <p className="text-sm text-destructive mt-1">{checkoutError}</p>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={clearCart}>
              Clear cart
            </Button>
            <Button onClick={handleCheckout} disabled={checkingOut} className="gap-2">
              <ShoppingBag className="w-4 h-4" />
              {checkingOut ? "Redirecting…" : "Checkout"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
