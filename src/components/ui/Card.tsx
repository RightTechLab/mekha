import { View } from 'react-native';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <View className={`bg-white border border-mekha-border rounded-2xl p-4 ${className}`}>
      {children}
    </View>
  );
}
