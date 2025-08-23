import { router, Stack } from "expo-router";
import React from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Feather from "@expo/vector-icons/Feather";
import { useProfileSecureStore } from "./profileStore";

export default function CustomerProfile() {
  const profileName = useProfileSecureStore(state => state.profileName)
  const phoneNumber = useProfileSecureStore((state) => state.phoneNumber);
  const lineId = useProfileSecureStore((state) => state.lineId);
  const paymentCycle = useProfileSecureStore((state) => state.paymentCycle);
  const firstPaymentDay = useProfileSecureStore((state) => state.firstPaymentDay);
  const premiumRate = useProfileSecureStore((state) => state.premiumRate);

  const onEdit = () => router.push("/profile/edit");
  const onCall = () => console.log("Call");
  const onShowQr = () => router.push("/profile/(modal)/qr");

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "Profile", headerShown: true }} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Header: Avatar + Name + Edit */}
        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={36} color="#4F378A" />
          </View>

          <View style={styles.titleWrap}>
            <Text style={styles.role}>บิตคอยเนอร์</Text>
            <Text style={styles.name}>{profileName}</Text>
          </View>

          <Pressable style={styles.editBtn} onPress={onEdit} hitSlop={10}>
            <MaterialCommunityIcons name="pencil" size={36} color="#4F378A" />
          </Pressable>
        </View>

        {/* Fields */}
        <Field
          label="โทรศัพท์"
          value={phoneNumber || ""}
          right={
            <Pressable style={styles.iconBtn} onPress={onCall} hitSlop={10}>
              <Feather name="phone-outgoing" size={24} color="#4F378A" />
            </Pressable>
          }
        />
        <Field label="Line ID" value={lineId || ""} />
        {/* <Field label="รอบจ่าย" value={paymentCycle || ""} /> */}
        {/* <Field label="วันแรกของรอบจ่าย" value={firstPaymentDay || ""} /> */}
        {/* <Field label="Premium" value={premiumRate || ""} /> */}

        {/* bottom spacer */}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Bottom Button */}
      <View style={styles.bottomBar}>
        <Pressable style={styles.primaryBtn} onPress={onShowQr}>
          <Text style={styles.primaryText}>แสดง QR code เชื่อมต่อ</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  right,
}: {
  label: string;
  value: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.fieldWrap}>
      <View style={styles.fieldTextWrap}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{value}</Text>
      </View>
      {right ? <View style={styles.fieldRight}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  topBar: { paddingHorizontal: 16, paddingTop: 8 },
  back: { flexDirection: "row", alignItems: "center" },
  backText: { color: "#4F378A", fontSize: 16, marginLeft: 2 },

  content: { paddingHorizontal: 20, paddingTop: 8 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 12,
  },
  avatar: {
    width: 56,
    aspectRatio: 1,
    borderRadius: 42,
    backgroundColor: "#EADDFF",
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: { flex: 1, marginLeft: 16 },
  role: { fontSize: 14, color: "#4F378A", fontWeight: "600" },
  name: { fontSize: 18, color: "#000", marginTop: 2 },

  editBtn: { padding: 6 },

  fieldWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EEE",
  },
  fieldTextWrap: { flex: 1 },
  fieldLabel: { color: "#6A6A6A", fontSize: 14, marginBottom: 4 },
  fieldValue: { color: "#000", fontSize: 16 },
  fieldRight: { marginLeft: 12, justifyContent: "center" },
  iconBtn: {
    padding: 6,
    borderRadius: 8,
  },

  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryBtn: {
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EADDFF",
    borderWidth: 2,
    borderColor: "#7A5FD0",
  },
  primaryText: {
    fontSize: 18,
    color: "#4F378A",
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
