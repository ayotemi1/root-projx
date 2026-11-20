import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, LogOut, LayoutDashboard, User, ShoppingBag } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";

const NAV_LINKS = [
  { href: "/feed", label: "Home" },
  { href: "/discover", label: "Discover" },
  { href: "/help", label: "Get help" },
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About" },
];

function CartLink() {
  const { totalItems } = useCart();
  return (
    <Link href="/shop" className="relative p-2 text-white hover:text-[#F3BF2C] transition-colors" aria-label="Cart" data-testid="nav-link-cart">
      <ShoppingBag className="w-[18px] h-[18px]" strokeWidth={1.75} />
      {totalItems > 0 && (
        <span className="absolute top-0 right-0 min-w-4 h-4 px-1 bg-[#F3BF2C] text-[#17100F] text-[10px] font-bold flex items-center justify-center leading-none">
          {totalItems > 9 ? "9+" : totalItems}
        </span>
      )}
    </Link>
  );
}

export default function Navbar() {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => location.startsWith(href);

  return (
    <header className="bg-[#CA0813] text-white sticky top-0 z-50 border-b-2 border-[#17100F]">
      <nav className="max-w-[1180px] mx-auto px-4 sm:px-8 flex items-center h-16 gap-6">
        <Link href="/" className="flex-shrink-0" data-testid="nav-link-logo">
          <img src="/logo-gold-v2.png" alt="Root ProjX" className="h-10 w-auto object-contain" />
        </Link>

        <div className="hidden md:flex items-stretch gap-1 flex-1 h-full py-3">
          {NAV_LINKS.map(({ href, label }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                data-testid={`nav-link-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className={`rp-label !text-[12px] flex items-center px-2.5 transition-colors ${
                  active ? "bg-[#F3BF2C] text-[#17100F]" : "text-white hover:bg-white/10"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <div className="hidden md:flex items-center gap-3 ml-auto">
          <CartLink />
          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 focus:outline-none" data-testid="nav-button-account">
                  <span className="w-9 h-9 bg-[#F3BF2C] text-[#17100F] border border-[#17100F] flex items-center justify-center text-sm font-bold">
                    {user.avatarInitials ?? user.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="text-sm text-white max-w-32 truncate">{user.name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-none border-[#17100F]">
                <DropdownMenuItem asChild>
                  <Link href="/account" className="flex items-center gap-2 cursor-pointer">
                    <User className="w-4 h-4" /> Account
                  </Link>
                </DropdownMenuItem>
                {user.accountType === "organisation" && (
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer">
                      <LayoutDashboard className="w-4 h-4" /> Dashboard
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive cursor-pointer flex items-center gap-2"
                  onClick={() => logout()}
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link href="/onboarding" className="text-[13px] text-white hover:underline underline-offset-4 whitespace-nowrap mr-1" data-testid="nav-link-apply">
                Apply as an organisation
              </Link>
              <Link href="/login" className="h-10 px-4 inline-flex items-center border-2 border-white text-white text-sm font-bold hover:bg-white hover:text-[#CA0813] transition-colors" data-testid="nav-link-login">
                Sign in
              </Link>
              <Link href="/register" className="h-10 px-5 inline-flex items-center border-2 border-[#17100F] bg-[#F3BF2C] text-[#17100F] text-sm font-bold hover:bg-[#F6CB4E] transition-colors" data-testid="nav-link-join">
                Join
              </Link>
            </>
          )}
        </div>

        <div className="md:hidden ml-auto flex items-center gap-1">
          <CartLink />
          <button
            className="text-white p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            data-testid="nav-button-menu"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="md:hidden border-t border-white/20 px-4 pb-5 pt-2 flex flex-col">
          {NAV_LINKS.map(({ href, label }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`rp-label !text-[13px] block px-3 py-3 border-b border-white/15 ${active ? "bg-[#F3BF2C] text-[#17100F]" : "text-white"}`}
              >
                {label}
              </Link>
            );
          })}
          <div className="mt-4 flex flex-col gap-2">
            {isAuthenticated ? (
              <>
                <Link href="/account" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm text-white">Account</Link>
                {user?.accountType === "organisation" && (
                  <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm text-white">Dashboard</Link>
                )}
                <button
                  className="text-left px-3 py-2.5 text-sm font-bold bg-[#17100F] text-white"
                  onClick={() => { logout(); setMobileOpen(false); }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/onboarding" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-sm text-white underline underline-offset-4" data-testid="nav-mobile-link-apply">
                  Apply as an organisation
                </Link>
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="h-11 flex items-center justify-center border-2 border-white text-white text-sm font-bold">Sign in</Link>
                  <Link href="/register" onClick={() => setMobileOpen(false)} className="h-11 flex items-center justify-center border-2 border-[#17100F] bg-[#F3BF2C] text-[#17100F] text-sm font-bold">Join</Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
