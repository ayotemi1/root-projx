import { XCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function ShopCancelPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-6">
        <XCircle className="w-10 h-10 text-muted-foreground" />
      </div>
      <h1 className="text-3xl font-extrabold text-foreground mb-2">Order cancelled</h1>
      <p className="text-muted-foreground max-w-sm mb-8">
        Your checkout was cancelled. Your cart is waiting whenever you're ready.
      </p>
      <div className="flex gap-3">
        <Link href="/shop">
          <Button>Return to shop</Button>
        </Link>
        <Link href="/">
          <Button variant="outline">Go home</Button>
        </Link>
      </div>
    </div>
  );
}
