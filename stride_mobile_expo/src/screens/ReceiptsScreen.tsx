import { api } from "@convex/_generated/api";
import { Doc, Id } from "@convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useAction, useQuery } from "convex/react";
import * as FileSystem from "expo-file-system/legacy";
import { shareAsync } from "expo-sharing";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import NBCard from "../components/NBCard";
import NBHeader from "../components/NBHeader";

type Receipt = Doc<"receipts">;
type ReceiptsRoute = RouteProp<
  { Receipts: { userId?: Id<"users"> } | undefined },
  "Receipts"
>;
type IoniconName = keyof typeof Ionicons.glyphMap;

export default function ReceiptsScreen() {
  const navigation = useNavigation();
  const route = useRoute<ReceiptsRoute>();
  const { userId } = route.params || {};

  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Fetch receipts from Convex
  const receipts =
    useQuery(
      api.receipts.getByUser,
      userId ? { userId } : "skip"
    ) || [];
  const downloadReceiptAction = useAction(api.actions.shelby.downloadReceipt);

  const onRefresh = async () => {
    setRefreshing(true);
    // Queries auto-update, but we can simulate a refresh delay
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleDownload = async (receipt: Receipt) => {
    setDownloading(receipt._id);

    try {
      const result = await downloadReceiptAction({
        blobName: receipt.blobName,
      });

      if (result.success && result.content) {
        const filename = receipt.blobName.split("/").pop() || "receipt.json";
        const fileUri = (FileSystem.documentDirectory || "") + filename;

        await FileSystem.writeAsStringAsync(fileUri, result.content, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        Alert.alert(
          "Receipt Downloaded",
          `Receipt saved to ${filename}`,
          [
            {
              text: "Share/Open",
              onPress: () => shareAsync(fileUri),
            },
            { text: "OK" },
          ]
        );
      } else {
        Alert.alert("Error", result.error || "Failed to download receipt content");
      }
    } catch (error) {
      console.error("Download error:", error);
      Alert.alert("Error", "Failed to download receipt");
    } finally {
      setDownloading(null);
    }
  };

  const handleShare = async (receipt: Receipt) => {
    // For sharing, we might want to download first if we want to share the file
    // Or just share the summary text
    // Let's reuse handleDownload logic but trigger share immediately
    handleDownload(receipt);
  };

  const getReceiptIcon = (type: Receipt["type"]): IoniconName => {
    switch (type) {
      case "monthly_report":
        return "calendar";
      case "sip_execution":
        return "repeat";
      case "deposit":
        return "arrow-down-circle";
      case "withdrawal":
        return "swap-vertical";
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
      case "withdrawal":
        return "bg-neo-purple";
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
      case "withdrawal":
        return "Withdrawal";
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
            <NBCard key={receipt._id} className="mb-4 bg-white">
              <View className="flex-row items-center gap-3 mb-3">
                <View
                  className={`w-12 h-12 border-2 border-black rounded-full items-center justify-center ${getReceiptColor(
                    receipt.type
                  )}`}
                >
                  <Ionicons
                    name={getReceiptIcon(receipt.type)}
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
                {receipt.summary || "No summary available"}
              </Text>

              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => handleDownload(receipt)}
                  disabled={downloading === receipt._id}
                  className="flex-1 bg-neo-blue border-2 border-black rounded-lg py-3 shadow-neo-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                >
                  {downloading === receipt._id ? (
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
                  disabled={downloading === receipt._id}
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
