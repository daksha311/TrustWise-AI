# 🛡️ TrustWise AI — Autonomous Escrow & AI Arbitration Protocol

[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity)](https://soliditylang.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7.0-646CFF?logo=vite)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Network](https://img.shields.io/badge/Network-Sepolia%20Testnet-7057ff?logo=ethereum)](https://sepolia.etherscan.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> Decentralized trustless escrow infrastructure paired with autonomous AI-driven arbitration and zkTLS evidence verification on the Ethereum Sepolia network.

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Repository Structure](#-repository-structure)
- [Smart Contract Blueprint](#-smart-contract-blueprint)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Smart Contracts Setup & Deployment](#1-smart-contracts-setup--deployment)
  - [2. Frontend Application Setup](#2-frontend-application-setup)
- [Application Routes & Workflow](#-application-routes--workflow)
- [Team](#-team)
- [License](#-license)

---

## 🚀 Overview

Traditional online escrow services suffer from high intermediary fees, slow resolution times, and central authority bias. **TrustWise AI** solves this by uniting smart contract safety on Ethereum with transparent, autonomous AI arbitration models.

When disputes arise over digital assets or service fulfillment, parties submit digital evidence and zkTLS cryptographic proofs. The autonomous arbiter evaluates the evidence metadata and programmatically settles the locked funds directly through smart contract execution vectors.

---

## ✨ Key Features

- 🔐 **Trustless Vault Allocation:** Lock Sepolia ETH natively in non-custodial smart contracts mapped directly to counterparty addresses.
- 🤖 **AI-Driven Dispute Resolution:** Autonomous arbitration agent routes evidence payloads to settle disputes programmatically without human bias.
- 🛡️ **zkTLS Cryptographic Verification:** Cryptographically verify off-chain evidence (proofs of delivery/payment) before routing to the AI agent.
- ⚡ **Reentrancy Protection & Custom Errors:** Highly optimized Solidity 0.8.24 contract architecture for minimal gas usage and max security.
- 🖥️ **Cyber Matrix Terminal UI:** Sleek, high-contrast reactive dashboard complete with real-time on-chain state synchronization and dynamic navigation deck.

---

## 🏗️ System Architecture

```
                   +-----------------------------------+
                   |        User / Web3 Wallet         |
                   +-----------------------------------+
                                     |
                                     v
                   +-----------------------------------+
                   |    TrustWise AI Client (Vite)     |
                   +-----------------------------------+
                              /             \
                             /               \
                            v                 v
+----------------------------------+   +----------------------------------+
|   Ethers.js v6 Web3 Connection   |   |   zkTLS Proofs & AI Agent API    |
+----------------------------------+   +----------------------------------+
                 |                                    |
                 v                                    v
+----------------------------------+   +----------------------------------+
|    Escrow.sol (Sepolia Testnet)  |<--|   Settlement / Verdict Dispatch  |
+----------------------------------+   +----------------------------------+
```

---

## 🛠️ Tech Stack

| Domain | Technology | Description |
| :--- | :--- | :--- |
| **Smart Contracts** | Solidity `0.8.24` | Core escrow transaction logic, events, and settlement handlers |
| **Development Suite**| Hardhat `2.x` | Compilation, test networks, and automated Sepolia deployment |
| **Frontend Engine** | React 19 + Vite 7 | Modern client runtime and fast HMR bundling framework |
| **Language** | TypeScript 5 | End-to-end typing for safety and contract ABI interfaces |
| **Web3 Client** | Ethers.js `v6.17.x` | Provider abstraction and contract read/write pipelines |
| **Routing** | React Router v7 | Dynamic client-side page navigation |
| **Blockchain** | Sepolia Testnet | Ethereum test network execution layer |

---

## 📂 Repository Structure

```
TrustWise-AI/
├── contracts/                        # Smart Contract Workspace
│   ├── contracts/
│   │   └── Escrow.sol               # Core Solidity Escrow Contract
│   ├── scripts/
│   │   └── deploy.ts                # Sepolia Deployment Script
│   ├── hardhat.config.ts            # Hardhat Compiler & Network Config
│   └── package.json
│
└── frontend/                         # React Frontend Application
├── src/
│   ├── pages/
│   │   ├── Dashboard.tsx        # System Stats & Wallet Overview
│   │   ├── CreateEscrow.tsx     # Escrow Creation & Asset Locking Form
│   │   ├── DisputeView.tsx      # AI Arbitration & Resolution Panel
│   │   └── History.tsx          # Historical On-Chain Ledger View
│   ├── contracts/
│   │   └── Escrow.json          # Compiled Smart Contract ABI
│   ├── config.ts                # Contract Address & Export Config
│   ├── web3Service.ts           # MetaMask Handshake & Ethers Service
│   └── App.tsx                  # Master Router & Cyber Terminal Shell
├── vite.config.ts
└── package.json
```

---

### 📜 Smart Contract Blueprint

The core contract (`Escrow.sol`) manages individual escrow transaction indexes (`escrowCounter`):

```solidity
enum Status { Pending, Disputed, Released, Refunded }

struct EscrowTransaction {
    address buyer;
    address seller;
    uint256 amount;
    uint256 timestamp;
    Status status;
    string evidenceHash; // IPFS/URI reference for documentation
    string aiVerdict;    // Stored verdict string from automated arbiter
}
```

#### Core Functions

* `createEscrow(address _seller)`: Initiates a new escrow vault and locks deposited ETH.
* `dispute(uint256 _escrowId, string calldata _evidenceHash)`: Escalates transaction status to `Disputed`.
* `releaseFunds(uint256 _escrowId, string calldata _aiVerdict)`: Programmatically transfers vault funds to the seller upon verification.
* `refundFunds(uint256 _escrowId, string calldata _aiVerdict)`: Programmatically refunds vault funds back to the buyer based on AI consensus.

---

## 🚦 Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) (v18.0 or higher)
* [MetaMask Wallet Extension](https://metamask.io/) connected to the Sepolia Testnet with test ETH.

---

### 1. Smart Contracts Setup & Deployment

1. **Navigate to the contracts folder:**

   ```bash
   cd contracts
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Compile the contract:**

   ```bash
   npx hardhat compile
   ```

4. **Deploy to Sepolia Testnet:**

   ```bash
   npx hardhat run scripts/deploy.ts --network sepolia
   ```

> 📌 *Copy the printed deployed contract address for your frontend configuration.*

---

### 2. Frontend Application Setup

1. **Navigate to the frontend folder:**

   ```bash
   cd ../frontend
   ```

2. **Install frontend dependencies:**

   ```bash
   npm install
   ```

3. **Sync Contract Address & ABI:**

   Ensure the compiled `Escrow.json` artifact from:

   ```text
   contracts/artifacts/contracts/Escrow.sol/Escrow.json
   ```

   is copied into:

   ```text
   frontend/src/contracts/Escrow.json
   ```

   Set your deployed contract address in `frontend/src/config.ts`:

   ```typescript
   export const CONTRACT_ADDRESS = "0xYOUR_SEPOLIA_CONTRACT_ADDRESS";

   import EscrowABI from "./contracts/Escrow.json";

   export const CONTRACT_ABI = EscrowABI.abi;
   ```

4. **Launch the Development Server:**

   ```bash
   npm run dev
   ```

5. **Access the Application:**

   Open your browser at:

   ```text
   http://localhost:5173/
   ```

---

## 🗺️ Application Routes & Workflow

* **Dashboard (`/`):** Connect your wallet, view network connections, and verify total active escrow counter metrics.
* **Initialize Escrow (`/create`):** Input the counterparty's Ethereum address, enter the deposit allocation in Sepolia ETH, and sign the creation transaction.
* **Arbitration Panel (`/dispute`):** Enter a target Escrow ID, review AI verdict payloads, and authorize programmatic asset releases or refunds.
* **Ledger Logs (`/history`):** Inspect tabular transaction logs and audit status registers.

---

## 👥 Team

* **Harsha K** — Frontend and Block chain
* **Daksha SG** — Backend

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---
