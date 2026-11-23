import { ShoppingBag } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { VisitorHeading } from "@/components/visitor/VisitorHeading";
import { NewsletterForm } from "@/components/visitor/NewsletterForm";

function VisitorShop() {
  return (
    <div className="max-w-[1240px] mx-auto px-5 md:px-8 py-12 md:py-16" data-testid="page-visitor-shop">
      <VisitorHeading label="Shop" title="Shop" intro="Merch is coming. Tees, totes and prints designed with artists from the communities we work with. Every purchase supports organisations on Root ProjX." />
      <p className="mt-10 text-[18px] font-bold text-[#17100F]">Be the first to know when it opens.</p>
      <div className="mt-4"><NewsletterForm id="shop-notify" button="Notify me" /></div>
    </div>
  );
}

export default function ShopPage() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <VisitorShop />;
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
