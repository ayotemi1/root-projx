import { CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function ShopSuccessPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
        <CheckCircle className="w-10 h-10 text-green-600" />
      </div>
      <h1 className="text-3xl font-extrabold text-foreground mb-2">Order confirmed!</h1>
      <p className="text-muted-foreground max-w-sm mb-6">
        Thank you for your purchase. Your order is on its way. A confirmation email will follow shortly.
      </p>
      <p className="text-sm text-muted-foreground mb-8">
        Every purchase directly supports grassroots organisations through Root ProjX.
      </p>
      <div className="flex gap-3">
        <Link href="/shop">
          <Button variant="outline">Back to shop</Button>
        </Link>
        <Link href="/">
          <Button>Go home</Button>
        </Link>
      </div>
    </div>
  );
}
