import { Modal as RNModal, View, Pressable, Text } from 'react-native';
import type { ReactNode } from 'react';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Modal({ visible, onClose, title, children }: ModalProps) {
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/40 items-center justify-center px-6"
        onPress={onClose}
      >
        <Pressable
          className="w-full max-w-md bg-white dark:bg-neutral-950 rounded-2xl p-6"
          onPress={(e) => e.stopPropagation()}
        >
          {title && (
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-bold text-mekha-text dark:text-neutral-50">{title}</Text>
              <Pressable onPress={onClose}>
                <Text className="text-mekha-muted text-lg">✕</Text>
              </Pressable>
            </View>
          )}
          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}
