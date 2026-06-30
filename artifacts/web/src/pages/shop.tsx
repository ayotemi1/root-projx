import { ShoppingBag } from "lucide-react";

export default function ShopPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-24 flex flex-col items-center justify-center text-center gap-6">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
        <ShoppingBag className="w-10 h-10 text-primary" />
      </div>
      <div>
        <h1 className="text-3xl font-extrabold text-foreground">Merch</h1>
        <p className="text-xl text-muted-foreground mt-2">Coming soon</p>
      </div>
    </div>
  );
}
