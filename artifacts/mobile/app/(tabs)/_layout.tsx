import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Image, Platform, StyleSheet } from "react-native";

const LogoWordmark = () => (
  <Image
    source={require("../../assets/images/logo.png")}
    style={{ height: 38, width: 130, resizeMode: "contain", marginLeft: 8 }}
    accessibilityLabel="Root ProjX"
  />
);

const TAB_BAR_BG = "#7A0000";
const TAB_ACTIVE = "#F5B800";
const TAB_INACTIVE = "rgba(255,255,255,0.65)";
const NAV_BG = "#7A0000";
const isIOS = Platform.OS === "ios";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: TAB_ACTIVE,
        tabBarInactiveTintColor: TAB_INACTIVE,
        headerStyle: { backgroundColor: NAV_BG },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontWeight: "700", color: "#FFFFFF" },
        headerLeft: () => <LogoWordmark />,
        tabBarStyle: {
          backgroundColor: TAB_BAR_BG,
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: isIOS ? 84 : 64,
          paddingBottom: isIOS ? 24 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="safari" tintColor={color} size={size} />
            ) : (
              <Feather name="compass" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="newspaper" tintColor={color} size={size} />
            ) : (
              <Feather name="activity" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="help"
        options={{
          title: "Get Help",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="lifepreserver" tintColor={color} size={size} />
            ) : (
              <Feather name="life-buoy" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="person" tintColor={color} size={size} />
            ) : (
              <Feather name="user" size={size} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

const _styles = StyleSheet.create({});
