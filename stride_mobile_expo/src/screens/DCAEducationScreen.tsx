import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { ScrollView, Text, View } from "react-native";
import NBButton from "../components/NBButton";
import NBCard from "../components/NBCard";
import NBHeader from "../components/NBHeader";

export default function DCAEducationScreen() {
  const navigation = useNavigation();

  return (
    <View className="flex-1 bg-neo-bg">
      <NBHeader
        title="What is DCA?"
        subtitle="Learn the Strategy"
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView className="flex-1 px-4 pt-6">
        {/* Hero Card */}
        <NBCard className="mb-6 bg-neo-purple">
          <View className="items-center py-4">
            <View className="w-20 h-20 bg-neo-yellow border-2 border-black rounded-full items-center justify-center mb-4">
              <Ionicons name="trending-up" size={40} color="black" />
            </View>
            <Text className="text-white font-black text-2xl uppercase text-center mb-2">
              Dollar Cost Averaging
            </Text>
            <Text className="text-white/80 font-bold text-sm text-center">
              The smart way to invest in crypto
            </Text>
          </View>
        </NBCard>

        {/* What is DCA */}
        <NBCard className="mb-6 bg-white">
          <Text className="text-black font-black text-xl mb-3 uppercase tracking-tight">
            What is DCA?
          </Text>
          <Text className="text-gray-700 font-bold text-base leading-6">
            Dollar Cost Averaging (DCA) is an investment strategy where you
            invest a fixed amount at regular intervals, regardless of the
            asset's price.
          </Text>
        </NBCard>

        {/* Why DCA Works */}
        <NBCard className="mb-6 bg-neo-yellow">
          <Text className="text-black font-black text-xl mb-4 uppercase tracking-tight">
            Why DCA Works
          </Text>

          <View className="gap-4">
            <View className="flex-row items-start gap-3">
              <View className="w-10 h-10 bg-black rounded-full items-center justify-center">
                <Ionicons name="shield-checkmark" size={20} color="#FDE047" />
              </View>
              <View className="flex-1">
                <Text className="text-black font-bold text-base mb-1">
                  Reduces Risk
                </Text>
                <Text className="text-black/70 font-bold text-sm">
                  By spreading investments over time, you avoid the risk of
                  investing all your money at a market peak
                </Text>
              </View>
            </View>

            <View className="flex-row items-start gap-3">
              <View className="w-10 h-10 bg-black rounded-full items-center justify-center">
                <Ionicons name="trending-down" size={20} color="#FDE047" />
              </View>
              <View className="flex-1">
                <Text className="text-black font-bold text-base mb-1">
                  Averages Out Volatility
                </Text>
                <Text className="text-black/70 font-bold text-sm">
                  You buy more when prices are low and less when prices are
                  high, averaging out your cost
                </Text>
              </View>
            </View>

            <View className="flex-row items-start gap-3">
              <View className="w-10 h-10 bg-black rounded-full items-center justify-center">
                <Ionicons name="calendar" size={20} color="#FDE047" />
              </View>
              <View className="flex-1">
                <Text className="text-black font-bold text-base mb-1">
                  Disciplined Investing
                </Text>
                <Text className="text-black/70 font-bold text-sm">
                  Automated investments remove emotion from the equation and
                  build a consistent habit
                </Text>
              </View>
            </View>

            <View className="flex-row items-start gap-3">
              <View className="w-10 h-10 bg-black rounded-full items-center justify-center">
                <Ionicons name="wallet" size={20} color="#FDE047" />
              </View>
              <View className="flex-1">
                <Text className="text-black font-bold text-base mb-1">
                  Accessible to All
                </Text>
                <Text className="text-black/70 font-bold text-sm">
                  Start with as little as ₹100 - no need for large lump sums
                </Text>
              </View>
            </View>
          </View>
        </NBCard>

        {/* Example Comparison */}
        <NBCard className="mb-6 bg-neo-blue">
          <Text className="text-black font-black text-xl mb-4 uppercase tracking-tight">
            DCA vs Lump Sum
          </Text>

          <View className="gap-4">
            {/* Lump Sum */}
            <View className="bg-white border-2 border-black rounded-lg p-4">
              <Text className="text-black font-bold text-base mb-2 uppercase">
                ❌ Lump Sum (Risky)
              </Text>
              <Text className="text-gray-700 font-bold text-sm mb-3">
                Invest ₹3,000 once when APT = ₹100
              </Text>
              <View className="bg-red-100 border-2 border-red-500 rounded-lg p-3">
                <Text className="text-red-800 font-bold text-sm">
                  Result: 30 APT @ ₹100 avg
                </Text>
                <Text className="text-red-600 text-xs font-bold mt-1">
                  High risk if price drops after purchase
                </Text>
              </View>
            </View>

            {/* DCA */}
            <View className="bg-white border-2 border-black rounded-lg p-4">
              <Text className="text-black font-bold text-base mb-2 uppercase">
                ✅ DCA (Smart)
              </Text>
              <Text className="text-gray-700 font-bold text-sm mb-3">
                Invest ₹100 daily for 30 days
              </Text>
              <View className="gap-2 mb-3">
                <Text className="text-gray-600 text-xs font-bold">
                  • Day 1-10: APT = ₹120 → Buy 8.33 APT
                </Text>
                <Text className="text-gray-600 text-xs font-bold">
                  • Day 11-20: APT = ₹80 → Buy 12.5 APT
                </Text>
                <Text className="text-gray-600 text-xs font-bold">
                  • Day 21-30: APT = ₹100 → Buy 10 APT
                </Text>
              </View>
              <View className="bg-green-100 border-2 border-green-500 rounded-lg p-3">
                <Text className="text-green-800 font-bold text-sm">
                  Result: 30.83 APT @ ₹97.3 avg
                </Text>
                <Text className="text-green-600 text-xs font-bold mt-1">
                  Better average price + lower risk!
                </Text>
              </View>
            </View>
          </View>
        </NBCard>

        {/* How Stride Makes it Easy */}
        <NBCard className="mb-6 bg-neo-pink">
          <Text className="text-black font-black text-xl mb-4 uppercase tracking-tight">
            How Stride Makes DCA Easy
          </Text>

          <View className="gap-3">
            <View className="flex-row items-center gap-3">
              <Ionicons name="flash" size={24} color="black" />
              <Text className="text-black font-bold text-base flex-1">
                Gas-Free: No transaction fees
              </Text>
            </View>

            <View className="flex-row items-center gap-3">
              <Ionicons name="calendar-outline" size={24} color="black" />
              <Text className="text-black font-bold text-base flex-1">
                Automated: Set it and forget it
              </Text>
            </View>

            <View className="flex-row items-center gap-3">
              <Ionicons name="wallet-outline" size={24} color="black" />
              <Text className="text-black font-bold text-base flex-1">
                UPI Deposits: Pay with any UPI app
              </Text>
            </View>

            <View className="flex-row items-center gap-3">
              <Ionicons name="trophy" size={24} color="black" />
              <Text className="text-black font-bold text-base flex-1">
                Earn Rewards: Get PHOTON tokens
              </Text>
            </View>

            <View className="flex-row items-center gap-3">
              <Ionicons name="document-text" size={24} color="black" />
              <Text className="text-black font-bold text-base flex-1">
                Tax Ready: Auto-generated receipts
              </Text>
            </View>
          </View>
        </NBCard>

        {/* CTA */}
        <NBButton
          title="Start Your First SIP"
          onPress={() => navigation.goBack()}
          className="mb-6 bg-neo-green"
          icon={<Ionicons name="rocket" size={24} color="black" />}
        />

        {/* Disclaimer */}
        <View className="bg-white/50 border-2 border-black/10 rounded-lg p-4 mb-6">
          <Text className="text-gray-600 font-bold text-xs uppercase text-center">
            Disclaimer: Cryptocurrency investments are subject to market risks.
            Past performance is not indicative of future results. Please invest
            responsibly.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
