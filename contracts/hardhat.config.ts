import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers"; 
import * as dotenv from "dotenv";

dotenv.config();

// Replace lines 7 and 8 in hardhat.config.ts with this:
const SEPOLIA_RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/sxN_HmwU7PvTLggySoVeN";
const PRIVATE_KEY = "f319f215cb9afd395d64c066a9e771dd2d558ccec771400ce622b1f847c6124a";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    sepolia: {
      type: "http", 
      url: SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
});