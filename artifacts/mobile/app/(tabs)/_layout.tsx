import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HamburgerMenu } from "@/components/HamburgerMenu";

const LogoWordmark = () => (
  <Image
    source={require("../../assets/images/logo.png")}
    style={{ height: 34, width: 34, resizeMode: "contain", marginLeft: 12 }}
    accessibilityLabel="Root ProjX"
  />
);

const TAB_BAR_BG = "#B50000";
const TAB_ACTIVE = "#F5B800";
const TAB_INACTIVE = "rgba(255,255,255,0.55)";
const NAV_BG = "#B50000";

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: TAB_ACTIVE,
        tabBarInactiveTintColor: TAB_INACTIVE,
        headerStyle: { backgroundColor: NAV_BG },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontWeight: "700", color: "#FFFFFF", fontSize: 17 },
        headerLeft: () => <LogoWordmark />,
        headerRight: () => <HamburgerMenu />,
        tabBarStyle: {
          backgroundColor: TAB_BAR_BG,
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, size }) => (
            <Feather name="compass" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="help"
        options={{
          title: "Get Help",
          tabBarIcon: ({ color, size }) => (
            <Feather name="life-buoy" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
