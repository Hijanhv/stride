# Stride 🇮🇳⚡️

**Bridging India's UPI payments to Aptos DeFi with recurring SIPs and Photon Rewards.**

Stride is a production-ready PayFi platform that enables Indian users to invest in crypto through Systematic Investment Plans (SIPs) using their familiar UPI payment methods. It leverages **Aptos Fungible Assets**, **Object-based Vaults**, and **Photon Identity** to create a seamless, gasless, and rewarding experience.

## 🏆 Hackathon Tracks Targeted
- **DeFi Trading**: Automated SIP execution via on-chain CLOBs (Econia/Decibel interface).
- **Payments & RWA**: Seamless UPI-to-Crypto on-ramp for recurring investments.
- **Consumer Apps**: "Login with Phone" and gamified rewards using Photon.

---

## 🏗 Architecture

The project is a Monorepo divided into three main components:

### 1. Smart Contracts (`/stride_contracts`)
Built with **Move** on Aptos, utilizing the modern **Token V2 (Fungible Asset)** standard.
- **`sip_vault.move`**: Creates a "Sticky Object" Vault for each user. This Vault holds the user's assets (USDC) and SIP configurations. It delegates withdrawal capabilities securely to the executor.
- **`executor.move`**: A permissionless (but admin-triggered) module that batches due SIPs, withdraws funds from user vaults, and executes Market Buy orders on the CLOB.
- **`clob_market.move`**: Defines the standard interface for on-chain order books (modeled after **Econia** and **Decibel**), ensuring the system is ready for mainnet liquidity integration.

### 2. Backend (Convex) 🚀
We use **Convex** as our serverless, real-time backend. It replaces the traditional Node.js server, handling database, scheduling, and API integrations seamlessly.
-   **Real-time Database**: Stores user profiles, SIP configurations, and transaction history, syncing instantly with the Mobile and Web apps.
-   **Serverless Functions**:
    -   `actions/photon.ts`: Handles secure communication with the **Photon API** (Identity & Rewards).
    -   `crons.ts`: A built-in scheduler that triggers SIP execution batches every hour.
-   **HTTP Actions**:
    -   `http.ts`: Exposes a webhook endpoint to receive mock UPI payment confirmations.

### 3. Mobile App (`/stride_mobile`)
**The "Rank 1" Native Experience.** Built with **Expo (React Native)** and **NativeWind**.
-   **Features**: "Login with Phone", "Scan to Invest" (QR), and Real-time Portfolio updates via Convex.

### 4. Web Dashboard (`/stride_frontend`)
A secondary admin/desktop view for detailed analytics, also powered by Convex.

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- Aptos CLI
- Convex Account

### Installation & Run

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/stride.git
   cd stride
   ```

2. **Setup Convex (Backend)**
   ```bash
   cd stride_convex
   npm install
   npx convex dev
   # This spins up the real-time backend and dashboard
   ```

3. **Start the Mobile App**
   ```bash
   cd stride_mobile
   npm install
   npx expo start
   # Scan the QR code with your phone (Expo Go)
   ```

4. **Start the Web Dashboard**
   ```bash
   cd stride_frontend
   npm install
   npm run dev
   ```

5. **Compile Smart Contracts**
   ```bash
   cd stride_contracts
   aptos move compile
   ```

## 💡 User Flow (Demo)

1. **Login**: Open the App -> Enter Phone Number -> Click "Login with Photon".
   - *Behind the scenes: Backend registers you with Photon and gets a real wallet address.*
2. **Dashboard**: You see your new Photon Wallet address at the top.
3. **Add Funds**: Click "Add Funds" -> Scan QR Code -> Click "Simulate Payment".
   - *Behind the scenes: Backend receives webhook -> Mints Mock USDC to your Vault.*
4. **SIP Execution**: The Inngest Scheduler runs (every hour).
   - *Behind the scenes: It sees your active SIP -> Executes Swap on Aptos -> Triggers Photon Reward.*
5. **Rewards**: You receive **PAT Tokens** as cashback for investing!

---
**Built with ❤️ for the Aptos Ecosystem.**
