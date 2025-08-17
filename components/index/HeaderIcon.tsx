import {
  Text,
  Modal,
  View,
  StyleSheet,
  Pressable,
  Platform,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Feather from "@expo/vector-icons/Feather";
import * as Clipboard from "expo-clipboard";
import { useNwcStore } from "@/lib/State/appStore";
import * as SecureStore from "expo-secure-store";
import { useCameraPermissions } from "expo-camera";
import { Link, router } from "expo-router";

export default function HeaderIcon() {
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<string>("");
  const setNwcUrl = useNwcStore((state) => state.setNwcUrl);

  const [permission, requestPermission] = useCameraPermissions();

  const onModalClose = () => {
    setIsModalVisible(false);
  };

  const onModalOpen = () => {
    setIsModalVisible(true);
  };

  const onMenuPress = () => {
    onModalOpen();
  };

  const onPastePress = async () => {
    try {
      // Get the text from clipboard
      const text = await Clipboard.getStringAsync();
      setCopiedText(text);

      // Validate if the pasted text looks like a valid NWC URL
      if (!text || !text.startsWith("nostr+walletconnect://")) {
        console.error("Invalid NWC URL format");
        // You might want to show an error message to the user here
        return;
      }

      // Store in Zustand state
      setNwcUrl(text);

      // Store in SecureStore
      await SecureStore.setItemAsync("nwcUrl", text);

      // Close the modal
      onModalClose();

      console.log("NWC URL saved successfully:", text);
    } catch (error) {
      console.error("Error saving NWC URL:", error);
      // You might want to show an error message to the user here
    }
  };

  const onScanPress = async () => {
    await requestPermission();
    console.log("Camera permission status:", permission?.granted);
    router.push("/scanner");
    onModalClose();
  };

  return (
    <View style={styles.header}>
      <Modal animationType="slide" visible={isModalVisible}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setIsModalVisible(false)}>
              <Text style={styles.closeButton}>×</Text>
            </Pressable>
          </View>

          {/* Welcome Text */}
          <View style={styles.welcomeContainer}>
            <Text style={styles.appNameText}>Mehala Shop</Text>
          </View>

          {/* Description Text */}
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionText}>
              แสกน QR code จากบิตคอยเนอร์ของคุณ
            </Text>
            <Text style={styles.descriptionText}>
              เพื่อเริ่มรับชำระด้วยบิตคอยน์
            </Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <Pressable
              style={styles.actionButton}
              onPress={() => {
                onPastePress();
              }}
            >
              <Feather name="clipboard" size={24} color="#6450A4" />
              <Text style={styles.buttonText}>วาง</Text>
            </Pressable>

            <Pressable
              style={styles.actionButton}
              onPress={() => {
                onScanPress();
              }}
            >
              <MaterialCommunityIcons
                name="qrcode-scan"
                size={24}
                color="#6450A4"
              />
              <Text style={styles.buttonText}>แสกน</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Pressable
        onPress={() => {
          router.push("/profile");
        }}
      >
        <Ionicons name="person-circle-outline" size={42} color="#4B3885" />
      </Pressable>

      <Pressable
        onPress={() => {
          onMenuPress();
        }}
      >
        <MaterialIcons name="menu" size={42} color="#000" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginTop: Platform.OS === "android" ? 20 : 0,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#6450A4",
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 20,
    marginTop: 20,
  },
  logoContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 40,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  image: {
    width: 100,
    height: 100,
  },
  welcomeContainer: {
    alignItems: "center",
    marginBottom: 60,
    // DEBUG:
    // backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  welcomeText: {
    color: "#FFFFFF",
    fontSize: 18,
    marginBottom: 8,
    fontWeight: "400",
  },
  appNameText: {
    color: "#FFFFFF",
    fontSize: 42,
    fontWeight: "400",
    letterSpacing: 1,
  },
  descriptionContainer: {
    alignItems: "center",
    marginBottom: 300,
    paddingHorizontal: 20,
    // DEBUG:
    // backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  descriptionText: {
    color: "#FFFFFF",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    opacity: 0.9,
  },
  buttonContainer: {
    position: "absolute",
    bottom: 50,
    width: "100%",
    gap: 16,
    paddingHorizontal: 20,
    // DEBUG:
    // backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginTop: 80,
  },
  actionButton: {
    backgroundColor: "rgba(234, 222, 255, 0.95)",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 20,
    paddingHorizontal: 30,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: "#6450A4",
    fontSize: 20,
    fontWeight: "500",
  },
  modalHeader: {
    position: "absolute",
    top: Platform.OS === "android" ? 30 : 50, // adjust for status bar
    right: 30, // push to right edge
    zIndex: 10,
  },

  closeButton: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
});
