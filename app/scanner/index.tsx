import { useNwcStore } from "@/lib/State/appStore";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Stack, router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useRef } from "react";
import { AppState, Button, Linking, Platform, SafeAreaView, StatusBar, Text } from "react-native";

export default function Scanner() {
  const setNwcUrl = useNwcStore((s) => s.setNwcUrl);
  const qrLock = useRef(false);
  const appState = useRef(AppState.currentState);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        qrLock.current = false;
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  if (!permission) {
    return null;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <Stack.Screen options={{ title: "ขอสิทธิ์กล้อง", headerShown: true }} />
        <Text style={{ fontSize: 16, textAlign: "center", marginBottom: 16 }}>
          ต้องการสิทธิ์กล้องเพื่อสแกน QR Code
        </Text>
        <Button title="อนุญาตการใช้กล้อง" onPress={Linking.openSettings} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "black" }}>
      <Stack.Screen
        options={{ title: "แสกน QR เชื่อมต่อ nwc", headerShown: true }}
      />
      {Platform.OS === "android" ? <StatusBar hidden /> : null}
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        onBarcodeScanned={({ data }) => {
          if (
            data &&
            !qrLock.current &&
            data.startsWith("nostr+walletconnect://")
          ) {
            qrLock.current = true;
            setTimeout(async () => {
              setNwcUrl(data);
              await SecureStore.setItemAsync("nwcUrl", data);
              router.replace("/");
            }, 500);
          }
        }}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      />
    </SafeAreaView>
  );
}
