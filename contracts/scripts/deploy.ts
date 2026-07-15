import { network } from "hardhat";

async function main() {
  console.log("Initiating TrustWise AI Smart Contract Deployment...");

  // 1. Create the Hardhat 3 network connection explicitly
  const { ethers, networkName } = await network.create();
  console.log(`Connected to network: ${networkName}`);

  // 2. Explicitly grab the signer wallet loaded from the accounts array
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("❌ Error: No deployment account signer found! Check your private key in .env");
  }
  console.log(`Deploying contract with account: ${deployer.address}`);

  // 3. Connect the factory to our signer account so it can write transactions
  const EscrowFactory = await ethers.getContractFactory("Escrow", deployer);
  const escrow = await EscrowFactory.deploy();

  console.log("Waiting for the deployment transaction to confirm...");
  await escrow.waitForDeployment();

  const contractAddress = await escrow.getAddress();
  console.log(`\n==================================================`);
  console.log(`🚀 Success! TrustWise AI Contract Deployed Safely.`);
  console.log(`📍 Contract Address: ${contractAddress}`);
  console.log(`==================================================\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});