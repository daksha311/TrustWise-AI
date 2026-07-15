const { ethers } = require('ethers');
const logger = require('../utils/logger');

/**
 * Smart Contract Service
 * 
 * Handles all blockchain interactions:
 * - Fetching escrow details
 * - Releasing funds
 * - Refunding buyers
 * - Checking contract state
 */
class ContractService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.contract = null;
    this.contractAddress = process.env.CONTRACT_ADDRESS;
    this.rpcUrl = process.env.SEPOLIA_RPC_URL;
    this.initialized = false;
  }

  /**
   * Initialize the contract connection
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Connect to Sepolia
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl);

      // For backend, we use a private key from env
      // This is for automation - the actual user signs with MetaMask
      if (process.env.PRIVATE_KEY) {
        this.signer = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
      }

      // Contract ABI (minimal - only what we need)
      const abi = [
        'function escrows(uint256) view returns (address buyer, address seller, uint256 amount, uint256 status, bool exists)',
        'function releaseFunds(uint256 escrowId) external',
        'function refundFunds(uint256 escrowId) external',
        'function createEscrow(address seller) external payable',
        'function dispute(uint256 escrowId, string memory evidence) external',
        'event FundsReleased(uint256 indexed escrowId, address indexed recipient, uint256 amount)',
        'event FundsRefunded(uint256 indexed escrowId, address indexed recipient, uint256 amount)',
        'event DisputeCreated(uint256 indexed escrowId, string evidence)'
      ];

      this.contract = new ethers.Contract(
        this.contractAddress,
        abi,
        this.signer || this.provider
      );

      this.initialized = true;
      logger.info(`Contract initialized at ${this.contractAddress}`);
    } catch (error) {
      logger.error(`Contract initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get escrow details
   */
  async getEscrow(escrowId) {
    await this.initialize();
    try {
      const escrow = await this.contract.escrows(escrowId);
      return {
        buyer: escrow.buyer,
        seller: escrow.seller,
        amount: ethers.formatEther(escrow.amount),
        status: this.getStatusText(escrow.status),
        exists: escrow.exists,
        statusCode: Number(escrow.status)
      };
    } catch (error) {
      logger.error(`Failed to get escrow ${escrowId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Release funds to seller (called by settlement executor)
   */
  async releaseFunds(escrowId, verificationHash) {
    await this.initialize();
    try {
      logger.info(`Releasing funds for escrow ${escrowId}...`);
      
      // If we have a signer (backend-controlled), execute transaction
      if (this.signer) {
        const tx = await this.contract.releaseFunds(escrowId, {
          gasLimit: 300000
        });
        const receipt = await tx.wait();
        logger.info(`Funds released! Tx: ${receipt.hash}`);
        return {
          success: true,
          transactionHash: receipt.hash,
          escrowId: escrowId,
          action: 'released_to_seller'
        };
      } else {
        // If no signer, return the transaction data for frontend to sign
        // This is the "MetaMask" flow - user signs with their wallet
        const txData = await this.contract.releaseFunds.populateTransaction(escrowId);
        return {
          success: true,
          requiresUserSignature: true,
          transaction: txData,
          action: 'released_to_seller'
        };
      }
    } catch (error) {
      logger.error(`Failed to release funds: ${error.message}`);
      throw error;
    }
  }

  /**
   * Refund funds to buyer
   */
  async refundFunds(escrowId) {
    await this.initialize();
    try {
      logger.info(`Refunding escrow ${escrowId}...`);
      
      if (this.signer) {
        const tx = await this.contract.refundFunds(escrowId, {
          gasLimit: 300000
        });
        const receipt = await tx.wait();
        logger.info(`Refunded! Tx: ${receipt.hash}`);
        return {
          success: true,
          transactionHash: receipt.hash,
          escrowId: escrowId,
          action: 'refunded_to_buyer'
        };
      } else {
        const txData = await this.contract.refundFunds.populateTransaction(escrowId);
        return {
          success: true,
          requiresUserSignature: true,
          transaction: txData,
          action: 'refunded_to_buyer'
        };
      }
    } catch (error) {
      logger.error(`Failed to refund: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get status text from status code
   */
  getStatusText(status) {
    const statuses = {
      0: 'Pending',
      1: 'Disputed',
      2: 'Released',
      3: 'Refunded'
    };
    return statuses[Number(status)] || 'Unknown';
  }

  /**
   * Check if contract is deployed and accessible
   */
  async healthCheck() {
    try {
      await this.initialize();
      const code = await this.provider.getCode(this.contractAddress);
      return {
        contractDeployed: code !== '0x',
        address: this.contractAddress,
        network: await this.provider.getNetwork()
      };
    } catch (error) {
      return {
        contractDeployed: false,
        error: error.message
      };
    }
  }
}

module.exports = new ContractService();