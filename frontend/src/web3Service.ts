declare global {
  interface Window {
    ethereum?: any;
  }
}

import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./config";

// 1. Request wallet connection from the browser extension
export const connectWallet = async () => {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed! Please install the extension.");
  }
  
  // Request account access
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  return accounts[0]; // Returns the active public key address
};

// 2. Instantiate a writable contract instance
export const getEscrowContract = async () => {
  if (!window.ethereum) throw new Error("No crypto wallet found.");

  // Wrap the native window provider with Ethers v6 structure
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  
  // Create the read/write contract connector
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
};