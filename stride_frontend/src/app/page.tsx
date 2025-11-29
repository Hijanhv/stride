"use client";

import { motion } from "framer-motion";
import { Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3001/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      
      if (data.wallet) {
        // Store Photon Wallet & Token
        localStorage.setItem("photon_wallet", data.wallet.walletAddress);
        localStorage.setItem("photon_token", data.tokens.access_token);
        localStorage.setItem("photon_user_id", data.user.user.id);
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Login failed", err);
      alert("Login failed. Check backend console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-black text-white flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-yellow-400">
            Stride
          </h1>
          <p className="text-gray-300 text-lg">
            India's First UPI-Powered Crypto SIP Platform
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Mobile Number
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  +91
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="98765 43210"
                  className="w-full bg-black/30 border border-white/10 rounded-lg py-3 pl-12 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                "Verifying..."
              ) : (
                <>
                  Login with Photon <Smartphone size={20} />
                </>
              )}
            </button>
          </form>
          
          <div className="mt-6 text-center text-xs text-gray-400">
            Powered by <span className="text-blue-400 font-semibold">Aptos</span> • <span className="text-green-400 font-semibold">Decibel</span> • <span className="text-purple-400 font-semibold">Photon</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
