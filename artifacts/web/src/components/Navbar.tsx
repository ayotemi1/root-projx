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
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/discover", label: "Discover" },
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About" },
  { href: "/help", label: "Get Help" },
];

const GOLD = "#F5C000";

function Avatar({ initials }: { initials: string }) {
  return (
    <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-sm font-bold cursor-pointer select-none">
      {initials}
    </div>
  );
}

export default function Navbar() {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { totalItems } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <header className="bg-nav text-white sticky top-0 z-50 shadow-md">
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center h-16 gap-6">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0">
          <img
            src="/logo.png"
            alt="Root ProjX"
            className="h-11 w-auto object-contain"
          />
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1 flex-1">
          {NAV_LINKS.map(({ href, label }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href}>
                <span
                  style={active ? { color: GOLD, borderBottom: `2px solid ${GOLD}` } : undefined}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors inline-block ${
                    active
                      ? "pb-1"
                      : "text-white hover:text-white/80"
                  }`}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Cart icon + Auth section */}
        <div className="hidden md:flex items-center gap-3 ml-auto">
          {/* Cart */}
          <Link href="/shop">
            <button className="relative p-1.5 text-white/80 hover:text-white transition-colors" aria-label="Cart">
              <ShoppingBag className="w-5 h-5" />
              {totalItems > 0 && (
                <span
                  style={{ backgroundColor: GOLD, color: "#111" }}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-extrabold flex items-center justify-center leading-none"
                >
                  {totalItems > 9 ? "9+" : totalItems}
                </span>
              )}
            </button>
          </Link>

          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 focus:outline-none">
                  <Avatar initials={user.avatarInitials ?? user.name.slice(0, 2).toUpperCase()} />
                  <span className="text-sm text-white/80 max-w-32 truncate">{user.name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
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
              <Link href="/login">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white text-white bg-transparent hover:bg-white/10 hover:text-white"
                >
                  Sign in
                </Button>
              </Link>
              <Link href="/register">
                <Button
                  size="sm"
                  style={{ backgroundColor: GOLD, color: "#111" }}
                  className="font-bold hover:opacity-90"
                >
                  Join
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile: cart icon + hamburger */}
        <div className="md:hidden ml-auto flex items-center gap-2">
          <Link href="/shop">
            <button className="relative p-1.5 text-white/80 hover:text-white transition-colors" aria-label="Cart">
              <ShoppingBag className="w-5 h-5" />
              {totalItems > 0 && (
                <span
                  style={{ backgroundColor: GOLD, color: "#111" }}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-extrabold flex items-center justify-center leading-none"
                >
                  {totalItems > 9 ? "9+" : totalItems}
                </span>
              )}
            </button>
          </Link>
          <button
            className="text-white p-1"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 px-4 pb-4 flex flex-col gap-1">
          {NAV_LINKS.map(({ href, label }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href} onClick={() => setMobileOpen(false)}>
                <span
                  style={active ? { color: GOLD, borderLeft: `3px solid ${GOLD}` } : undefined}
                  className={`block px-3 py-2 rounded-md text-sm font-medium ${
                    active ? "pl-3" : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {label}
                </span>
              </Link>
            );
          })}
          <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1">
            {isAuthenticated ? (
              <>
                <Link href="/account" onClick={() => setMobileOpen(false)}>
                  <span className="block px-3 py-2 text-sm text-white/80 hover:bg-white/10 rounded-md">
                    Account
                  </span>
                </Link>
                {user?.accountType === "organisation" && (
                  <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                    <span className="block px-3 py-2 text-sm text-white/80 hover:bg-white/10 rounded-md">
                      Dashboard
                    </span>
                  </Link>
                )}
                <button
                  className="text-left px-3 py-2 text-sm text-destructive-foreground bg-destructive/10 hover:bg-destructive/20 rounded-md"
                  onClick={() => { logout(); setMobileOpen(false); }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  <span className="block px-3 py-2 text-sm border border-white/40 rounded-md text-white text-center">
                    Sign in
                  </span>
                </Link>
                <Link href="/register" onClick={() => setMobileOpen(false)}>
                  <span
                    style={{ backgroundColor: GOLD, color: "#111" }}
                    className="block px-3 py-2 text-sm font-bold rounded-md text-center"
                  >
                    Join
                  </span>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
