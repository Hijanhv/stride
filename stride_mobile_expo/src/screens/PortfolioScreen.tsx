import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import NBCard from "../components/NBCard";
import NBHeader from "../components/NBHeader";

export default function PortfolioScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<
    "1D" | "1W" | "1M" | "ALL"
  >("1M");

  // Mock data - replace with Convex queries
  const portfolioData = {
    totalValue: 12500,
    totalInvested: 10000,
    totalReturns: 2500,
    roi: 25.0,
    holdings: [
      {
        symbol: "APT",
        name: "Aptos",
        amount: 125.5,
        value: 8500,
        invested: 7000,
        avgPrice: 55.78,
        currentPrice: 67.73,
        roi: 21.4,
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        amount: 4000,
        value: 4000,
        invested: 3000,
        avgPrice: 0.75,
        currentPrice: 1.0,
        roi: 33.3,
      },
    ],
    recentTransactions: [
      {
        id: "1",
        type: "sip_execution",
        amount: 100,
        tokenSymbol: "APT",
        tokensReceived: 1.48,
        timestamp: Date.now() - 3600000,
        status: "success",
      },
      {
        id: "2",
        type: "deposit",
        amount: 500,
        timestamp: Date.now() - 7200000,
        status: "success",
      },
    ],
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Refetch from Convex
    // await convex.query(api.users.getPortfolio, { userId });
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <View className="flex-1 bg-neo-bg">
      <NBHeader
        title="Portfolio"
        subtitle="Your Investments"
        rightElement={
          <TouchableOpacity
            onPress={() => navigation.navigate("Receipts")}
            className="bg-neo-yellow px-3 py-2 border-2 border-black rounded-full shadow-neo-sm"
          >
            <View className="flex-row items-center gap-1">
              <Ionicons name="document-text" size={16} color="black" />
              <Text className="text-black font-bold text-xs uppercase">
                Receipts
              </Text>
            </View>
          </TouchableOpacity>
        }
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
        {/* Total Portfolio Value */}
        <NBCard variant="highlight" className="mb-6 bg-neo-purple">
          <Text className="text-white/70 text-sm font-bold mb-1 uppercase tracking-wider">
            Total Portfolio Value
          </Text>
          <Text className="text-white text-5xl font-black mb-2">
            ₹{portfolioData.totalValue.toLocaleString("en-IN")}
          </Text>

          <View className="flex-row gap-4 mb-4">
            <View className="flex-1">
              <Text className="text-white/70 text-xs font-bold uppercase mb-1">
                Invested
              </Text>
              <Text className="text-white font-black text-lg">
                ₹{portfolioData.totalInvested.toLocaleString("en-IN")}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-white/70 text-xs font-bold uppercase mb-1">
                Returns
              </Text>
              <Text className="text-neo-green font-black text-lg">
                +₹{portfolioData.totalReturns.toLocaleString("en-IN")}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-white/70 text-xs font-bold uppercase mb-1">
                ROI
              </Text>
              <Text className="text-neo-green font-black text-lg">
                +{portfolioData.roi}%
              </Text>
            </View>
          </View>

          {/* Period Selector */}
          <View className="flex-row gap-2">
            {(["1D", "1W", "1M", "ALL"] as const).map((period) => (
              <TouchableOpacity
                key={period}
                onPress={() => setSelectedPeriod(period)}
                className={`flex-1 py-2 rounded-lg border-2 ${
                  selectedPeriod === period
                    ? "bg-white border-white"
                    : "bg-transparent border-white/30"
                }`}
              >
                <Text
                  className={`text-center font-bold text-xs uppercase ${
                    selectedPeriod === period ? "text-black" : "text-white"
                  }`}
                >
                  {period}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </NBCard>

        {/* Holdings */}
        <Text className="text-black font-black text-2xl mb-4 uppercase tracking-tighter">
          Your Holdings
        </Text>

        {portfolioData.holdings.map((holding) => (
          <NBCard key={holding.symbol} className="mb-4 bg-white">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 bg-neo-blue border-2 border-black rounded-full items-center justify-center shadow-neo-sm">
                  <Text className="text-black font-black text-lg">
                    {holding.symbol[0]}
                  </Text>
                </View>
                <View>
                  <Text className="text-black font-bold text-lg">
                    {holding.name}
                  </Text>
                  <Text className="text-gray-600 text-xs font-bold uppercase">
                    {holding.amount.toFixed(2)} {holding.symbol}
                  </Text>
                </View>
              </View>
              <View className="items-end">
                <Text className="text-black font-black text-lg">
                  ₹{holding.value.toLocaleString("en-IN")}
                </Text>
                <Text
                  className={`font-bold text-sm ${
                    holding.roi >= 0 ? "text-neo-green" : "text-red-500"
                  }`}
                >
                  {holding.roi >= 0 ? "+" : ""}
                  {holding.roi.toFixed(1)}%
                </Text>
              </View>
            </View>

            {/* DCA Stats */}
            <View className="bg-neo-bg border-2 border-black/10 rounded-lg p-3 gap-2">
              <View className="flex-row justify-between">
                <Text className="text-gray-600 font-bold text-xs uppercase">
                  Avg Buy Price
                </Text>
                <Text className="text-black font-bold text-sm">
                  ₹{holding.avgPrice.toFixed(2)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-600 font-bold text-xs uppercase">
                  Current Price
                </Text>
                <Text className="text-black font-bold text-sm">
                  ₹{holding.currentPrice.toFixed(2)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-600 font-bold text-xs uppercase">
                  Total Invested
                </Text>
                <Text className="text-black font-bold text-sm">
                  ₹{holding.invested.toLocaleString("en-IN")}
                </Text>
              </View>
            </View>
          </NBCard>
        ))}

        {/* DCA Performance Chart Placeholder */}
        <NBCard className="mb-6 bg-neo-yellow">
          <View className="flex-row items-center gap-2 mb-3">
            <Ionicons name="trending-up" size={24} color="black" />
            <Text className="text-black font-black text-lg uppercase tracking-tight">
              DCA Performance
            </Text>
          </View>

          <View className="bg-white border-2 border-black rounded-lg p-4 items-center">
            <Ionicons name="bar-chart" size={48} color="#8B5CF6" />
            <Text className="text-black font-bold text-sm mt-2 uppercase">
              Chart Coming Soon
            </Text>
            <Text className="text-gray-600 text-xs font-bold uppercase">
              Historical DCA analysis
            </Text>
          </View>
        </NBCard>

        {/* Recent Transactions */}
        <Text className="text-black font-black text-2xl mb-4 uppercase tracking-tighter">
          Recent Activity
        </Text>

        {portfolioData.recentTransactions.map((tx) => (
          <NBCard key={tx.id} className="mb-4 bg-white">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View
                  className={`w-10 h-10 border-2 border-black rounded-full items-center justify-center ${
                    tx.type === "sip_execution" ? "bg-neo-blue" : "bg-neo-green"
                  }`}
                >
                  <Ionicons
                    name={
                      tx.type === "sip_execution"
                        ? "repeat"
                        : "arrow-down-circle"
                    }
                    size={20}
                    color="black"
                  />
                </View>
                <View>
                  <Text className="text-black font-bold text-base">
                    {tx.type === "sip_execution" ? "SIP Execution" : "Deposit"}
                  </Text>
                  <Text className="text-gray-600 text-xs font-bold uppercase">
                    {new Date(tx.timestamp).toLocaleString("en-IN", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </Text>
                </View>
              </View>
              <View className="items-end">
                <Text className="text-black font-black text-base">
                  ₹{tx.amount}
                </Text>
                {tx.tokensReceived && (
                  <Text className="text-neo-purple font-bold text-xs">
                    +{tx.tokensReceived} {tx.tokenSymbol}
                  </Text>
                )}
              </View>
            </View>
          </NBCard>
        ))}

        {/* Download Reports */}
        <NBCard className="mb-6 bg-neo-pink">
          <View className="flex-row items-center gap-2 mb-3">
            <Ionicons name="download" size={24} color="black" />
            <Text className="text-black font-black text-lg uppercase tracking-tight">
              Download Reports
            </Text>
          </View>

          <View className="gap-2">
            <TouchableOpacity
              className="bg-white border-2 border-black rounded-lg p-4 shadow-neo-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
              onPress={() => {
                // TODO: Download monthly report
                alert("Downloading monthly report...");
              }}
            >
              <View className="flex-row justify-between items-center">
                <Text className="text-black font-bold uppercase">
                  Monthly Report
                </Text>
                <Ionicons name="chevron-forward" size={20} color="black" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-white border-2 border-black rounded-lg p-4 shadow-neo-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
              onPress={() => {
                // TODO: Download tax summary
                alert("Downloading tax summary...");
              }}
            >
              <View className="flex-row justify-between items-center">
                <Text className="text-black font-bold uppercase">
                  Tax Summary
                </Text>
                <Ionicons name="chevron-forward" size={20} color="black" />
              </View>
            </TouchableOpacity>
          </View>
        </NBCard>
      </ScrollView>
    </View>
  );
}
