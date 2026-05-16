import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StripeProvider, usePaymentSheet } from "@stripe/stripe-react-native";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  sizes: string[];
  emoji: string;
}

const PRODUCTS: Product[] = [
  {
    id: "tshirt",
    name: "Root ProjX T-Shirt",
    price: 25,
    description: "100% organic cotton. Gold logo on front, 'Restoration. Culture. Access.' on back.",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    emoji: "👕",
  },
  {
    id: "hoodie",
    name: "Root ProjX Hoodie",
    price: 55,
    description: "Premium heavyweight hoodie. Embroidered logo. Unisex fit.",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    emoji: "🧥",
  },
  {
    id: "tote",
    name: "Root ProjX Tote",
    price: 15,
    description: "Heavy-duty canvas tote. Gold screen-printed logo. Fits your whole world.",
    sizes: ["One Size"],
    emoji: "👜",
  },
  {
    id: "cap",
    name: "Root ProjX Cap",
    price: 30,
    description: "5-panel structured cap. Embroidered logo. Adjustable strap.",
    sizes: ["One Size"],
    emoji: "🧢",
  },
];

interface CartItem {
  product: Product;
  size: string;
  qty: number;
}

function ProductCard({
  product,
  onAddToCart,
}: {
  product: Product;
  onAddToCart: (product: Product, size: string) => void;
}) {
  const colors = useColors();
  const [selectedSize, setSelectedSize] = useState<string | null>(
    product.sizes.length === 1 ? product.sizes[0]! : null,
  );

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.cardTop}>
        <View style={[s.productEmoji, { backgroundColor: colors.secondary }]}>
          <Text style={{ fontSize: 36 }}>{product.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.productName, { color: colors.foreground }]}>{product.name}</Text>
          <Text style={[s.productPrice, { color: colors.primary }]}>£{product.price}</Text>
        </View>
      </View>

      <Text style={[s.productDesc, { color: colors.mutedForeground }]}>{product.description}</Text>

      {product.sizes.length > 1 && (
        <>
          <Text style={[s.sizeLabel, { color: colors.mutedForeground }]}>Size</Text>
          <View style={s.sizesRow}>
            {product.sizes.map((sz) => (
              <Pressable
                key={sz}
                style={[
                  s.sizeBtn,
                  { borderColor: colors.border, backgroundColor: colors.secondary },
                  selectedSize === sz && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setSelectedSize(sz)}
              >
                <Text style={[
                  s.sizeBtnText,
                  { color: colors.mutedForeground },
                  selectedSize === sz && { color: "#FFFFFF", fontWeight: "700" },
                ]}>
                  {sz}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Pressable
        style={[
          s.addBtn,
          { backgroundColor: colors.accent },
          !selectedSize && { opacity: 0.45 },
        ]}
        onPress={() => {
          if (!selectedSize) {
            Alert.alert("Select a size", "Please select a size before adding to cart.");
            return;
          }
          onAddToCart(product, selectedSize);
        }}
      >
        <Text style={[s.addBtnText, { color: colors.accentForeground }]}>
          {!selectedSize && product.sizes.length > 1 ? "Select a size" : "Add to Cart"}
        </Text>
      </Pressable>
    </View>
  );
}

function CartModal({
  cart,
  visible,
  onClose,
  onRemove,
  onCheckout,
  isCheckingOut,
}: {
  cart: CartItem[];
  visible: boolean;
  onClose: () => void;
  onRemove: (idx: number) => void;
  onCheckout: () => void;
  isCheckingOut: boolean;
}) {
  const colors = useColors();
  const total = cart.reduce((sum, item) => sum + item.product.price * item.qty, 0);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.modalOverlay}>
        <View style={[s.cartSheet, { backgroundColor: colors.background }]}>
          <View style={s.cartHeader}>
            <Text style={[s.cartTitle, { color: colors.foreground }]}>Your Cart</Text>
            <Pressable onPress={onClose}>
              <Text style={{ fontSize: 24, color: colors.mutedForeground }}>✕</Text>
            </Pressable>
          </View>

          {cart.length === 0 ? (
            <View style={s.emptyCart}>
              <Text style={{ fontSize: 32 }}>🛒</Text>
              <Text style={[s.emptyCartText, { color: colors.mutedForeground }]}>
                Your cart is empty
              </Text>
            </View>
          ) : (
            <>
              <ScrollView style={{ maxHeight: 300 }}>
                {cart.map((item, i) => (
                  <View key={i} style={[s.cartItem, { borderBottomColor: colors.border }]}>
                    <Text style={{ fontSize: 24, marginRight: 10 }}>{item.product.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.cartItemName, { color: colors.foreground }]}>
                        {item.product.name}
                      </Text>
                      <Text style={[s.cartItemSize, { color: colors.mutedForeground }]}>
                        Size: {item.size} · Qty: {item.qty}
                      </Text>
                    </View>
                    <Text style={[s.cartItemPrice, { color: colors.primary }]}>
                      £{(item.product.price * item.qty).toFixed(2)}
                    </Text>
                    <Pressable onPress={() => onRemove(i)} style={{ marginLeft: 10 }}>
                      <Text style={{ color: colors.mutedForeground, fontSize: 18 }}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>

              <View style={[s.cartTotal, { borderTopColor: colors.border }]}>
                <Text style={[s.cartTotalLabel, { color: colors.foreground }]}>Total</Text>
                <Text style={[s.cartTotalAmount, { color: colors.primary }]}>
                  £{total.toFixed(2)}
                </Text>
              </View>

              <Pressable
                style={[s.checkoutBtn, { backgroundColor: colors.primary }, isCheckingOut && { opacity: 0.7 }]}
                onPress={onCheckout}
                disabled={isCheckingOut}
              >
                {isCheckingOut ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={s.checkoutBtnText}>Checkout · £{total.toFixed(2)}</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function ShopContent() {
  const colors = useColors();
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartVisible, setCartVisible] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [success, setSuccess] = useState(false);

  const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();

  function addToCart(product: Product, size: string) {
    setCart((prev) => {
      const existing = prev.findIndex((i) => i.product.id === product.id && i.size === size);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing]!, qty: next[existing]!.qty + 1 };
        return next;
      }
      return [...prev, { product, size, qty: 1 }];
    });
    Alert.alert("Added to cart", `${product.name} (${size}) added.`, [
      { text: "Keep shopping" },
      { text: "View cart", onPress: () => setCartVisible(true) },
    ]);
  }

  function removeFromCart(idx: number) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleCheckout() {
    if (!isAuthenticated) {
      Alert.alert(
        "Sign in required",
        "Please sign in to complete your purchase.",
        [{ text: "OK" }],
      );
      return;
    }

    const total = cart.reduce((sum, item) => sum + item.product.price * item.qty, 0);
    if (total <= 0) return;

    setIsCheckingOut(true);
    try {
      const key = await api.getStripePublishableKey();
      const { error: initErr } = await initPaymentSheet({
        paymentIntentClientSecret: "",
        merchantDisplayName: "Root ProjX Shop",
        style: "alwaysLight",
        primaryButtonLabel: `Pay £${total.toFixed(2)}`,
      });

      if (initErr) {
        Alert.alert("Checkout unavailable", "Please try again later.");
        return;
      }

      const { error: presentErr } = await presentPaymentSheet();
      if (!presentErr) {
        setCart([]);
        setCartVisible(false);
        setSuccess(true);
      }
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsCheckingOut(false);
    }
  }

  if (success) {
    return (
      <View style={s.successContainer}>
        <Text style={{ fontSize: 60, marginBottom: 16 }}>🎉</Text>
        <Text style={[s.successTitle, { color: colors.foreground }]}>Order confirmed!</Text>
        <Text style={[s.successMsg, { color: colors.mutedForeground }]}>
          Thank you for supporting Root ProjX. Your order is on its way.
        </Text>
        <Pressable
          style={[s.backBtn, { backgroundColor: colors.primary }]}
          onPress={() => setSuccess(false)}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Shop more</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <View style={[s.shopHeader, { backgroundColor: colors.navBackground }]}>
        <Text style={s.shopTitle}>Root ProjX Shop</Text>
        <Text style={s.shopSubtitle}>Wear the movement. Every purchase supports the platform.</Text>

        {cart.length > 0 && (
          <Pressable
            style={s.cartPill}
            onPress={() => setCartVisible(true)}
          >
            <Text style={s.cartPillText}>🛒 Cart ({cart.reduce((s, i) => s + i.qty, 0)})</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={PRODUCTS}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <ProductCard product={item} onAddToCart={addToCart} />
        )}
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      />

      <CartModal
        cart={cart}
        visible={cartVisible}
        onClose={() => setCartVisible(false)}
        onRemove={removeFromCart}
        onCheckout={handleCheckout}
        isCheckingOut={isCheckingOut}
      />
    </>
  );
}

export default function ShopScreen() {
  const colors = useColors();
  const [publishableKey, setPublishableKey] = useState<string | null>(null);

  React.useEffect(() => {
    api.getStripePublishableKey()
      .then((r) => setPublishableKey(r.publishableKey))
      .catch(() => setPublishableKey(""));
  }, []);

  if (publishableKey === null) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]} edges={["bottom"]}>
      <StripeProvider publishableKey={publishableKey} merchantIdentifier="merchant.com.rootprojx">
        <ShopContent />
      </StripeProvider>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  shopHeader: {
    padding: 20,
    paddingTop: 28,
    paddingBottom: 20,
  },
  shopTitle: { fontFamily: "DancingScript_700Bold", fontSize: 28, color: "#FFFFFF" },
  shopSubtitle: { color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 4 },
  cartPill: {
    alignSelf: "flex-start",
    marginTop: 12,
    backgroundColor: "#F5B800",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  cartPillText: { color: "#1A1A1A", fontWeight: "700", fontSize: 13 },
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: "rgba(0,0,0,0.06)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: { flexDirection: "row", gap: 14, marginBottom: 10 },
  productEmoji: {
    width: 70,
    height: 70,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  productName: { fontSize: 16, fontWeight: "700", flex: 1 },
  productPrice: { fontSize: 20, fontWeight: "800", marginTop: 4 },
  productDesc: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  sizeLabel: { fontSize: 12, fontWeight: "600", marginBottom: 8 },
  sizesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  sizeBtn: {
    borderRadius: 7,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 44,
    alignItems: "center",
  },
  sizeBtnText: { fontSize: 13 },
  addBtn: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  addBtnText: { fontWeight: "800", fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  cartSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  cartHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  cartTitle: { fontSize: 20, fontWeight: "800" },
  emptyCart: { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyCartText: { fontSize: 16 },
  cartItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  cartItemName: { fontSize: 14, fontWeight: "600" },
  cartItemSize: { fontSize: 12, marginTop: 2 },
  cartItemPrice: { fontSize: 15, fontWeight: "700" },
  cartTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderTopWidth: 1,
    marginTop: 8,
  },
  cartTotalLabel: { fontSize: 16, fontWeight: "700" },
  cartTotalAmount: { fontSize: 22, fontWeight: "800" },
  checkoutBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  checkoutBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
  successContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  successTitle: { fontSize: 28, fontWeight: "800", textAlign: "center" },
  successMsg: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  backBtn: { borderRadius: 10, paddingVertical: 14, paddingHorizontal: 32, marginTop: 12 },
});
