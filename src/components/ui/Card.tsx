import { View } from 'react-native';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <View className={`bg-white dark:bg-neutral-900 border border-mekha-border dark:border-neutral-800 rounded-2xl p-4 ${className}`}>
      {children}
    </View>
  );
}
