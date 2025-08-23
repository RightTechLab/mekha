import "@/lib/applyGlobalPolyfills";
import {
  Modal,
  View,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
} from "react-native";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as Clipboard from "expo-clipboard";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Feather from "@expo/vector-icons/Feather";

import HeaderIcon from "@/components/index/HeaderIcon";
import BalanceCard from "@/components/index/BalanceCard";
import TransactionList from "@/components/index/TransactionList";
import { getBitcoinPrice } from "@/lib/getBitcoinPrice";
import ReceiveIcon from "@/components/index/ReceiveIcon";
import { getSatBalance } from "@/lib/getSatBalance";
import { covertSatToThb } from "@/lib/covertSatToThb";
import { useBalanceStore, useNwcStore } from "@/lib/State/appStore";
import { useCameraPermissions } from "expo-camera";

export default function Index() {
  const [balanceTHB, setBalanceTHB] = useState<number>(0);
  const [bitcoinPrice, setBitcoinPrice] = useState<number>(0);
  const [satBalance, setSatBalance] = useState<number>(0);

  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<string>("");

  const [permission, requestPermission] = useCameraPermissions();
  const isPermissionGranted = Boolean(permission?.granted);

  const nwcUrl = useNwcStore((state) => state.nwcUrl);
  const setNwcUrl = useNwcStore((state) => state.setNwcUrl);

   const loadAllThbReceive = useBalanceStore((state) => state.loadAllThbReceive);
  const isLoaded = useBalanceStore((state) => state.isLoaded);

  const fetchCopiedText = async () => {
    const text = await Clipboard.getStringAsync();
    setCopiedText(text);
  };

  const onModalClose = () => {
    setIsModalVisible(false);
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

  const PlaceholderImage = require("@/assets/icons/mekhala-ios-light.png");

  const checkNwcUrl = async () => {
    const storedNwcUrl = await SecureStore.getItemAsync("nwcUrl");

    if (storedNwcUrl) {
      setNwcUrl(storedNwcUrl);
      setIsModalVisible(false);
    } else {
      setIsModalVisible(true);
    }
  };

  const onScanPress = async () => {
    await requestPermission();
    router.push("/scanner");
    onModalClose();
  };

  const fetchSatBalance = async () => {
    try {
      const balance = await getSatBalance(nwcUrl);
      setSatBalance(balance);
      const thbBalance = await covertSatToThb(balance);
      setBalanceTHB(thbBalance);
    } catch (error) {
      console.error("Error fetching satoshi balance:", error);
    }
  };

  const fetchBtcPrice = async () => {
    try {
      const btcPrice = await getBitcoinPrice();
      setBitcoinPrice(btcPrice);
    } catch (error) {
      console.error("Error fetching Bitcoin price:", error);
    }
  };

  useEffect(() => {
    checkNwcUrl();
  }, []);

  useEffect(() => {
    loadAllThbReceive();
  }, [loadAllThbReceive]);

  useEffect(() => {
    if (nwcUrl) {
      fetchBtcPrice();
      fetchSatBalance();
      const interval = setInterval(fetchBtcPrice, 60000);
      return () => clearInterval(interval);
    }
  }, [nwcUrl]);

  return (
    <SafeAreaView style={styles.container}>
      <Modal animationType="slide" visible={isModalVisible}>
        <View style={styles.modalContainer}>
          {/* Logo Container */}
          <View style={styles.logoContainer}>
            <Image
              style={styles.image}
              source={PlaceholderImage}
              contentFit="contain"
              transition={1000}
            />
          </View>

          {/* Welcome Text */}
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>ยินดีต้อนรับสู่แอพ</Text>
            <Text style={styles.appNameText}>Mekha Shop</Text>
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
            <Pressable style={styles.actionButton} onPress={onPastePress}>
              <Feather name="clipboard" size={24} color="#6450A4" />
              <Text style={styles.buttonText}>วาง</Text>
            </Pressable>

            <Pressable style={styles.actionButton} onPress={onScanPress}>
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

      <HeaderIcon />

      {/*  NOTE: Test when store nwc already */}
      {/* <View style={{ justifyContent: "center", alignItems: "center" }}> */}
      {/*   <Pressable */}
      {/*     onPress={async () => { */}
      {/*       await SecureStore.deleteItemAsync("nwcUrl"); */}
      {/*     }} */}
      {/*   > */}
      {/*     <Text> Test delete nwcUrl</Text> */}
      {/*   </Pressable> */}
      {/* </View> */}

      {/* NOTE: Test go to screen cremara */}
      {/* <View style={{ justifyContent: "center", alignItems: "center" }}> */}
      {/*   <Pressable onPress={() => router.push("/scanner")}> */}
      {/*     <Text>Go to scanner</Text> */}
      {/*   </Pressable> */}
      {/* </View> */}

      <Pressable onPress={() => router.push("/receiveThb")}>
        <BalanceCard balanceTHB={balanceTHB} bitcoinPrice={bitcoinPrice} />
      </Pressable>
      <TransactionList />
      <Pressable
        onPress={() => router.push("/transactionHistory")}
        style={styles.transactionButton}
      >
        <Text style={styles.transactionText}>ดูประวัติธุรกรรมทั้งหมด</Text>
      </Pressable>
      <ReceiveIcon />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  transactionButton: {
    // backgroundColor: "#47a2abc4",
    backgroundColor: "#fff",
    alignItems: "center",
    marginTop: 40,
    marginHorizontal: 20,
  },
  transactionText: {
    color: "#000",
    fontSize: 16,
    marginBottom: 20,
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
});
