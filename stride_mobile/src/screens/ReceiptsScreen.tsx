import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import NBCard from "../components/NBCard";
import NBHeader from "../components/NBHeader";

interface Receipt {
  id: string;
  type: "sip_execution" | "deposit" | "monthly_report" | "tax_summary";
  blobName: string;
  summary: string;
  period?: string;
  createdAt: number;
}

export default function ReceiptsScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Mock data - replace with Convex query
  const receipts: Receipt[] = [
    {
      id: "1",
      type: "monthly_report",
      blobName: "monthly-reports/user123/2024-01.json",
      summary: "January 2024 Investment Report",
      period: "2024-01",
      createdAt: Date.now() - 86400000,
    },
    {
      id: "2",
      type: "sip_execution",
      blobName: "sip-receipts/user123/receipt-1.json",
      summary: "SIP Execution - ₹100 → 1.48 APT",
      createdAt: Date.now() - 3600000,
    },
    {
      id: "3",
      type: "deposit",
      blobName: "deposits/user123/deposit-1.json",
      summary: "UPI Deposit - ₹500",
      createdAt: Date.now() - 7200000,
    },
  ];

  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Fetch receipts from Convex
    // await convex.query(api.receipts.getByUser, { userId });
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleDownload = async (receipt: Receipt) => {
    setDownloading(receipt.id);

    try {
      // TODO: Call Convex action to download from Shelby
      // const result = await convex.action(api.actions.shelby.downloadReceipt, {
      //   blobName: receipt.blobName,
      // });

      // For now, show success message
      Alert.alert(
        "Receipt Downloaded",
        `${receipt.summary}\n\nReceipt has been saved to your device.`,
        [
          {
            text: "Share",
            onPress: () => handleShare(receipt),
          },
          { text: "OK" },
        ]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to download receipt");
    } finally {
      setDownloading(null);
    }
  };

  const handleShare = async (receipt: Receipt) => {
    try {
      await Share.share({
        message: `Stride Receipt\n\n${receipt.summary}\n\nGenerated: ${new Date(receipt.createdAt).toLocaleString("en-IN")}`,
        title: "Stride Receipt",
      });
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  const getReceiptIcon = (type: Receipt["type"]) => {
    switch (type) {
      case "monthly_report":
        return "calendar";
      case "sip_execution":
        return "repeat";
      case "deposit":
        return "arrow-down-circle";
      case "tax_summary":
        return "document-text";
      default:
        return "document";
    }
  };

  const getReceiptColor = (type: Receipt["type"]) => {
    switch (type) {
      case "monthly_report":
        return "bg-neo-purple";
      case "sip_execution":
        return "bg-neo-blue";
      case "deposit":
        return "bg-neo-green";
      case "tax_summary":
        return "bg-neo-yellow";
      default:
        return "bg-white";
    }
  };

  const getReceiptLabel = (type: Receipt["type"]) => {
    switch (type) {
      case "monthly_report":
        return "Monthly Report";
      case "sip_execution":
        return "SIP Execution";
      case "deposit":
        return "Deposit";
      case "tax_summary":
        return "Tax Summary";
      default:
        return "Receipt";
    }
  };

  return (
    <View className="flex-1 bg-neo-bg">
      <NBHeader
        title="Receipts"
        subtitle="Transaction History"
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        className="flex-1 px-4 pt-6"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#000"
          />
        }
      >
        {/* Info Card */}
        <NBCard className="mb-6 bg-neo-yellow">
          <View className="flex-row items-center gap-3">
            <View className="w-12 h-12 bg-black rounded-full items-center justify-center">
              <Ionicons name="shield-checkmark" size={24} color="#FDE047" />
            </View>
            <View className="flex-1">
              <Text className="text-black font-black text-base uppercase">
                Compliance Ready
              </Text>
              <Text className="text-black/70 font-bold text-xs">
                All receipts stored securely on Shelby for audit & tax purposes
              </Text>
            </View>
          </View>
        </NBCard>

        {/* Receipts List */}
        {receipts.length === 0 ? (
          <NBCard className="bg-white">
            <View className="items-center py-8">
              <Ionicons
                name="document-text-outline"
                size={64}
                color="#9CA3AF"
              />
              <Text className="text-gray-600 font-bold text-lg mt-4 uppercase">
                No Receipts Yet
              </Text>
              <Text className="text-gray-500 font-bold text-sm mt-1">
                Receipts will appear here after transactions
              </Text>
            </View>
          </NBCard>
        ) : (
          receipts.map((receipt) => (
            <NBCard key={receipt.id} className="mb-4 bg-white">
              <View className="flex-row items-center gap-3 mb-3">
                <View
                  className={`w-12 h-12 border-2 border-black rounded-full items-center justify-center ${getReceiptColor(
                    receipt.type
                  )}`}
                >
                  <Ionicons
                    name={getReceiptIcon(receipt.type) as any}
                    size={24}
                    color="black"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-black font-bold text-base uppercase">
                    {getReceiptLabel(receipt.type)}
                  </Text>
                  <Text className="text-gray-600 text-xs font-bold">
                    {new Date(receipt.createdAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </Text>
                </View>
              </View>

              <Text className="text-black font-bold text-sm mb-3">
                {receipt.summary}
              </Text>

              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => handleDownload(receipt)}
                  disabled={downloading === receipt.id}
                  className="flex-1 bg-neo-blue border-2 border-black rounded-lg py-3 shadow-neo-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                >
                  {downloading === receipt.id ? (
                    <ActivityIndicator color="black" />
                  ) : (
                    <View className="flex-row items-center justify-center gap-2">
                      <Ionicons name="download" size={16} color="black" />
                      <Text className="text-black font-bold uppercase text-sm">
                        Download
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleShare(receipt)}
                  disabled={downloading === receipt.id}
                  className="flex-1 bg-neo-yellow border-2 border-black rounded-lg py-3 shadow-neo-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                >
                  <View className="flex-row items-center justify-center gap-2">
                    <Ionicons name="share-social" size={16} color="black" />
                    <Text className="text-black font-bold uppercase text-sm">
                      Share
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </NBCard>
          ))
        )}
      </ScrollView>
    </View>
  );
}
