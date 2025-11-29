"use client";

import { motion } from "framer-motion";
import { Plus, QrCode, Wallet } from "lucide-react";
import { useState } from "react";

export default function Dashboard() {
  const [balance, setBalance] = useState(0); // Mock USDC
  const [showQR, setShowQR] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");

  // Load Photon Wallet on mount
  useState(() => {
    if (typeof window !== "undefined") {
      const addr = localStorage.getItem("photon_wallet");
      if (addr) setWalletAddress(addr);
    }
  });

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Header */}
      <header className="p-4 flex justify-between items-center bg-white/5 backdrop-blur-md sticky top-0 z-10">
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-yellow-400">
          Stride
        </h1>
        <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-xs font-medium">
            {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Photon Wallet Active"}
          </span>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {/* Portfolio Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 shadow-lg relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
          
          <div className="relative z-10">
            <p className="text-indigo-200 text-sm mb-1">Total Portfolio Value</p>
            <h2 className="text-4xl font-bold mb-4">₹{balance.toLocaleString('en-IN')}</h2>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowQR(true)}
                className="flex-1 bg-white text-indigo-900 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors"
              >
                <QrCode size={18} /> Add Funds
              </button>
              <button className="flex-1 bg-indigo-800/50 text-white py-2 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-indigo-800 transition-colors">
                <Wallet size={18} /> Withdraw
              </button>
            </div>
          </div>
        </motion.div>

        {/* Active SIPs */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Your SIPs</h3>
            <button className="text-orange-400 text-sm font-medium flex items-center gap-1">
              <Plus size={16} /> New SIP
            </button>
          </div>

          {/* Empty State / Mock SIP */}
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 font-bold">
                A
              </div>
              <div>
                <h4 className="font-semibold">Aptos (APT)</h4>
                <p className="text-xs text-gray-400">Daily • ₹100</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-green-400">+12.5%</p>
              <p className="text-xs text-gray-500">Next: 2h 15m</p>
            </div>
          </div>
        </div>

        {/* Rewards Section */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-yellow-400 flex items-center gap-2">
                Photon Rewards
              </h3>
              <p className="text-xs text-gray-400">Earn points on every SIP execution</p>
            </div>
            <div className="bg-yellow-400/10 text-yellow-400 px-3 py-1 rounded-full text-sm font-bold">
              1,250 PTS
            </div>
          </div>
          <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
            <div className="bg-yellow-400 h-full w-[65%]"></div>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-right">750 pts to next tier</p>
        </div>
      </main>

      {/* UPI QR Modal */}
      {showQR && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white text-black rounded-2xl p-6 w-full max-w-sm text-center"
          >
            <h3 className="text-xl font-bold mb-2">Scan to Pay</h3>
            <p className="text-gray-500 text-sm mb-6">Add funds via any UPI App</p>
            
            <div className="bg-gray-100 p-4 rounded-xl mb-6 mx-auto w-64 h-64 flex items-center justify-center">
               {/* Placeholder for QR */}
               <QrCode size={120} className="text-gray-800" />
            </div>

            <div className="space-y-3">
              <button 
                onClick={() => {
                  setBalance(balance + 500);
                  setShowQR(false);
                }}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700"
              >
                Simulate Payment (₹500)
              </button>
              <button 
                onClick={() => setShowQR(false)}
                className="w-full text-gray-500 font-medium"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
