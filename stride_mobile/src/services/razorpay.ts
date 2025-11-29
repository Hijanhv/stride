import { Linking } from "react-native";
import RazorpayCheckout from "react-native-razorpay";

/**
 * Razorpay Integration Service
 *
 * Handles UPI payment processing for deposits
 */

// Configuration
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_test_";
const CONVEX_URL =
  process.env.CONVEX_URL || "https://your-deployment.convex.site";

export interface PaymentOptions {
  amount: number; // in rupees (will be converted to paise)
  userId: string;
  userName?: string;
  userPhone: string;
  userEmail?: string;
  description?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  orderId?: string;
  signature?: string;
  error?: string;
}

/**
 * Initiate UPI payment using Razorpay SDK
 * Opens UPI apps directly (GPay, PhonePe, etc.)
 */
export const initiateUPIPayment = async (
  options: PaymentOptions
): Promise<PaymentResult> => {
  try {
    // First, create order on backend
    const orderResponse = await fetch(`${CONVEX_URL}/razorpay/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: options.amount * 100, // Convert to paise
        userId: options.userId,
      }),
    });

    const orderData = await orderResponse.json();

    if (!orderData.success) {
      return {
        success: false,
        error: orderData.error || "Failed to create order",
      };
    }

    // Open Razorpay checkout
    const razorpayOptions = {
      description:
        options.description || `Add ₹${options.amount} to Stride wallet`,
      image: "https://your-logo-url.com/logo.png", // TODO: Add your logo
      currency: "INR",
      key: RAZORPAY_KEY_ID,
      amount: options.amount * 100, // in paise
      name: "Stride DCA",
      order_id: orderData.orderId,
      prefill: {
        name: options.userName || "",
        email: options.userEmail || "",
        contact: options.userPhone,
      },
      theme: {
        color: "#8B5CF6", // Purple theme
        backdrop_color: "#000000",
      },
      method: {
        upi: true, // Enable UPI
        card: false, // Disable cards for now
        netbanking: false,
        wallet: false,
      },
      notes: {
        userId: options.userId,
        purpose: "wallet_deposit",
      },
    };

    const data = await RazorpayCheckout.open(razorpayOptions);

    // Payment successful
    console.log("[Razorpay] Payment success:", data);

    return {
      success: true,
      paymentId: data.razorpay_payment_id,
      orderId: data.razorpay_order_id,
      signature: data.razorpay_signature,
    };
  } catch (error: any) {
    console.error("[Razorpay] Payment error:", error);

    // User cancelled or payment failed
    if (error.code === 0) {
      return {
        success: false,
        error: "Payment cancelled by user",
      };
    }

    return {
      success: false,
      error: error.description || error.message || "Payment failed",
    };
  }
};

/**
 * Generate UPI deep link (alternative to SDK)
 * Opens any UPI app directly
 */
export const generateUPILink = (
  amount: number,
  transactionNote: string = "Stride Deposit"
): string => {
  const vpa = "stride@ybl"; // Your merchant VPA
  const name = "Stride";

  return `upi://pay?pa=${vpa}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;
};

/**
 * Open UPI app directly (simple integration)
 */
export const openUPIApp = async (
  amount: number,
  transactionNote: string = "Stride Deposit"
): Promise<boolean> => {
  try {
    const upiLink = generateUPILink(amount, transactionNote);
    const canOpen = await Linking.canOpenURL(upiLink);

    if (canOpen) {
      await Linking.openURL(upiLink);
      return true;
    }

    return false;
  } catch (error) {
    console.error("[UPI] Failed to open UPI app:", error);
    return false;
  }
};

/**
 * Get QR code for UPI payment
 * Returns base64 image that can be displayed
 */
export const getUPIQRCode = async (
  amount: number,
  userId: string
): Promise<{
  success: boolean;
  qrCode?: string;
  upiLink?: string;
  error?: string;
}> => {
  try {
    const response = await fetch(`${CONVEX_URL}/razorpay/generate-qr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amount * 100, // Convert to paise
        userId,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: data.error || "Failed to generate QR code",
      };
    }

    return {
      success: true,
      qrCode: data.qrCode,
      upiLink: data.upiLink,
    };
  } catch (error) {
    console.error("[Razorpay] QR generation error:", error);

    return {
      success: false,
      error: "Failed to generate QR code",
    };
  }
};

/**
 * Verify payment status
 */
export const verifyPayment = async (
  paymentId: string
): Promise<{ success: boolean; status?: string; error?: string }> => {
  try {
    const response = await fetch(`${CONVEX_URL}/razorpay/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId }),
    });

    const data = await response.json();

    return {
      success: data.success,
      status: data.status,
      error: data.error,
    };
  } catch (error) {
    console.error("[Razorpay] Verification error:", error);

    return {
      success: false,
      error: "Failed to verify payment",
    };
  }
};
