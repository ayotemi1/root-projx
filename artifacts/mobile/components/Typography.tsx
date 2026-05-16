import React from "react";
import { Text, TextStyle } from "react-native";

interface HeadingProps {
  children: React.ReactNode;
  size?: number;
  color?: string;
  style?: TextStyle;
  numberOfLines?: number;
}

export function Heading({ children, size = 32, color = "#FFFFFF", style, numberOfLines }: HeadingProps) {
  return (
    <Text
      style={[
        {
          fontFamily: "DancingScript_700Bold",
          fontSize: size,
          color,
          lineHeight: size * 1.2,
        },
        style,
      ]}
      numberOfLines={numberOfLines}
    >
      {children}
    </Text>
  );
}

export function SubHeading({ children, size = 22, color = "#FFFFFF", style, numberOfLines }: HeadingProps) {
  return (
    <Text
      style={[
        {
          fontFamily: "DancingScript_600SemiBold",
          fontSize: size,
          color,
          lineHeight: size * 1.2,
        },
        style,
      ]}
      numberOfLines={numberOfLines}
    >
      {children}
    </Text>
  );
}
