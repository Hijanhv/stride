import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "convex/react";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "../../convex/_generated/api";
import NBButton from "../components/NBButton";
import NBCard from "../components/NBCard";
import NBHeader from "../components/NBHeader";
import { initiateUPIPayment, openUPIApp } from "../services/razorpay";

interface DepositScreenProps {
  route: {
    params: {
      userId: string;
      userName?: string;
      userPhone: string;
    };
  };
}

export default function DepositScreen({ route }: DepositScreenProps) {
  const navigation = useNavigation();
  const { userId, userName, userPhone } = route.params;

  const [amount, setAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"sdk" | "link">("sdk");

  // Quick amount buttons
  const quickAmounts = [100, 500, 1000, 5000];

  const handlePayment = async () => {
    const amountNum = parseInt(amount);

    if (isNaN(amountNum) || amountNum < 100) {
      Alert.alert("Invalid Amount", "Minimum deposit is ₹100");
      return;
    }

    if (amountNum > 100000) {
      Alert.alert("Invalid Amount", "Maximum deposit is ₹1,00,000");
      return;
    }

    setLoading(true);

    try {
      if (paymentMethod === "sdk") {
        // Use Razorpay SDK (recommended)
        const result = await initiateUPIPayment({
          amount: amountNum,
          userId,
          userName,
          userPhone,
          description: `Add ₹${amountNum} to Stride wallet`,
        });

        if (result.success) {
          Alert.alert(
            "Payment Successful! 🎉",
            `₹${amountNum} has been added to your wallet. Your balance will be updated shortly.`,
            [
              {
                text: "OK",
                onPress: () => navigation.goBack(),
              },
            ]
          );
        } else {
          Alert.alert("Payment Failed", result.error || "Please try again");
        }
      } else {
        // Use UPI deep link (fallback)
        const opened = await openUPIApp(
          amountNum,
          `Stride deposit - ${userId}`
        );

        if (opened) {
          Alert.alert(
            "Payment Initiated",
            "Complete the payment in your UPI app. Your balance will be updated automatically.",
            [
              {
                text: "OK",
                onPress: () => navigation.goBack(),
              },
            ]
          );
        } else {
          Alert.alert(
            "No UPI App Found",
            "Please install a UPI app (GPay, PhonePe, Paytm) to continue"
          );
        }
      }
    } catch (error) {
      console.error("[Deposit] Payment error:", error);
      Alert.alert("Error", "Failed to process payment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch real-time exchange rate
  const exchangeRateData = useQuery(api.oracle.getExchangeRate);
  const exchangeRate = exchangeRateData?.success ? exchangeRateData.rate : null;

  // Calculate estimated USDC
  const getEstimatedUsdc = () => {
    if (!amount || !exchangeRate) return "0.00";
    const amountNum = parseInt(amount);
    if (isNaN(amountNum)) return "0.00";
    return (amountNum / exchangeRate).toFixed(2);
  };

  return (
    <View className="flex-1 bg-neo-bg">
      <NBHeader
        title="Add Money"
        subtitle="Deposit via UPI"
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView className="flex-1 px-4 pt-6">
        {/* Amount Input */}
        <NBCard className="mb-6 bg-white">
          <Text className="text-black font-black text-lg mb-3 uppercase tracking-tight">
            Enter Amount
          </Text>

          <View className="flex-row items-center border-2 border-black rounded-xl p-4 bg-neo-bg mb-4">
            <Text className="text-black font-black text-3xl mr-2">₹</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="100"
              placeholderTextColor="#999"
              className="flex-1 text-black font-black text-3xl"
              editable={!loading}
            />
          </View>

          {/* Quick Amount Buttons */}
          <View className="flex-row gap-2 mb-2">
            {quickAmounts.map((amt) => (
              <TouchableOpacity
                key={amt}
                onPress={() => setAmount(amt.toString())}
                disabled={loading}
                className="flex-1 bg-neo-yellow border-2 border-black rounded-lg py-3 shadow-neo-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
              >
                <Text className="text-black font-bold text-center">₹{amt}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-gray-600 text-xs font-bold uppercase text-center mt-2">
            Min: ₹100 • Max: ₹1,00,000
          </Text>
        </NBCard>

        {/* Payment Method */}
        <NBCard className="mb-6 bg-neo-purple">
          <View className="flex-row items-center gap-2 mb-4">
            <Ionicons name="flash" size={24} color="#FDE047" />
            <Text className="text-white font-black text-lg uppercase tracking-tight">
              Gas-Free Deposit
            </Text>
          </View>

          <Text className="text-white font-bold text-sm mb-4">
            All transaction fees are sponsored by Stride. You pay exactly what
            you deposit!
          </Text>

          <View className="bg-black/20 border-2 border-white/30 rounded-lg p-3">
            <View className="flex-row justify-between items-center">
              <Text className="text-white font-bold">You Pay:</Text>
              <Text className="text-neo-yellow font-black text-xl">
                ₹{amount || "0"}
              </Text>
            </View>
            
            <View className="flex-row justify-between items-center mt-2">
              <Text className="text-white font-bold">You Get (Est.):</Text>
              <Text className="text-white font-black text-lg">
                {exchangeRate ? `${getEstimatedUsdc()} USDC` : "Loading..."}
              </Text>
            </View>

            <View className="flex-row justify-between items-center mt-2">
              <Text className="text-white/70 font-bold text-xs">Gas Fees:</Text>
              <Text className="text-neo-green font-bold text-xs">
                ₹0 (FREE!)
              </Text>
            </View>
            
            <Text className="text-white/50 text-[10px] font-bold mt-2 text-right">
              Rate: {exchangeRate ? `₹${exchangeRate.toFixed(2)} / USD` : "Fetching live rate..."}
            </Text>
          </View>
        </NBCard>

        {/* UPI Apps Info */}
        <NBCard className="mb-6 bg-neo-blue">
          <Text className="text-black font-black text-lg mb-3 uppercase tracking-tight">
            Supported UPI Apps
          </Text>

          <View className="flex-row flex-wrap gap-3">
            {["GPay", "PhonePe", "Paytm", "BHIM", "Amazon Pay"].map((app) => (
              <View
                key={app}
                className="bg-white border-2 border-black rounded-lg px-4 py-2 shadow-neo-sm"
              >
                <Text className="text-black font-bold text-sm">{app}</Text>
              </View>
            ))}
          </View>

          <Text className="text-black/70 font-bold text-xs mt-3 uppercase">
            Works with any UPI app
          </Text>
        </NBCard>

        {/* Payment Button */}
        <NBButton
          title={loading ? "Processing..." : "Pay with UPI"}
          onPress={handlePayment}
          disabled={loading || !amount || parseInt(amount) < 100}
          className="mb-6 bg-neo-green"
          icon={
            loading ? (
              <ActivityIndicator color="black" />
            ) : (
              <Ionicons name="checkmark-circle" size={24} color="black" />
            )
          }
        />

        {/* Security Info */}
        <View className="bg-white/50 border-2 border-black/10 rounded-lg p-4 mb-6">
          <View className="flex-row items-center gap-2 mb-2">
            <Ionicons name="shield-checkmark" size={20} color="#10B981" />
            <Text className="text-black font-bold text-sm uppercase">
              Secure Payment
            </Text>
          </View>
          <Text className="text-gray-600 text-xs font-bold">
            Powered by Razorpay • PCI DSS Compliant • 256-bit SSL Encryption
          </Text>
        </View>

        {/* How it Works */}
        <NBCard className="mb-6 bg-neo-yellow">
          <Text className="text-black font-black text-lg mb-3 uppercase tracking-tight">
            How It Works
          </Text>

          <View className="gap-3">
            <View className="flex-row items-start gap-3">
              <View className="w-8 h-8 bg-black rounded-full items-center justify-center">
                <Text className="text-neo-yellow font-black">1</Text>
              </View>
              <View className="flex-1">
                <Text className="text-black font-bold">Enter amount</Text>
                <Text className="text-black/70 text-xs font-bold">
                  Minimum ₹100
                </Text>
              </View>
            </View>

            <View className="flex-row items-start gap-3">
              <View className="w-8 h-8 bg-black rounded-full items-center justify-center">
                <Text className="text-neo-yellow font-black">2</Text>
              </View>
              <View className="flex-1">
                <Text className="text-black font-bold">Select UPI app</Text>
                <Text className="text-black/70 text-xs font-bold">
                  GPay, PhonePe, or any UPI app
                </Text>
              </View>
            </View>

            <View className="flex-row items-start gap-3">
              <View className="w-8 h-8 bg-black rounded-full items-center justify-center">
                <Text className="text-neo-yellow font-black">3</Text>
              </View>
              <View className="flex-1">
                <Text className="text-black font-bold">Confirm payment</Text>
                <Text className="text-black/70 text-xs font-bold">
                  Instant confirmation
                </Text>
              </View>
            </View>

            <View className="flex-row items-start gap-3">
              <View className="w-8 h-8 bg-black rounded-full items-center justify-center">
                <Text className="text-neo-yellow font-black">4</Text>
              </View>
              <View className="flex-1">
                <Text className="text-black font-bold">Start investing</Text>
                <Text className="text-black/70 text-xs font-bold">
                  Create SIPs and earn rewards
                </Text>
              </View>
            </View>
          </View>
        </NBCard>
      </ScrollView>
    </View>
  );
}
