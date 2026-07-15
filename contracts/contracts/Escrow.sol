// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title TrustWiseAI Escrow Protocol
 * @notice Handles decentralized escrow logic with AI-driven dispute resolution arbitration inputs.
 */
contract Escrow {
    
    enum Status { Pending, Disputed, Released, Refunded }

    struct EscrowTransaction {
        address buyer;
        address seller;
        uint256 amount;
        uint256 timestamp;
        Status status;
        string evidenceHash; // IPFS/URI hash of initial terms or text evidence
        string aiVerdict;    // Final stored text verdict from the automated arbiter
    }

    // State Variables
    uint256 public escrowCounter;
    mapping(uint256 => EscrowTransaction) public escrows;

    // Custom Errors for Gas Optimization
    error Unauthorized();
    error InvalidStatus();
    error ValueCannotBeZero();
    error InvalidAddress();

    // Events for Frontend Subscriptions (Track A UI)
    event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed seller, uint256 amount);
    event EscrowDisputed(uint256 indexed escrowId, string evidenceHash);
    event EscrowReleased(uint256 indexed escrowId, string aiVerdict);
    event EscrowRefunded(uint256 indexed escrowId, string aiVerdict);

    // Modifiers
    modifier onlyBuyer(uint256 _escrowId) {
        if (msg.sender != escrows[_escrowId].buyer) revert Unauthorized();
        _;
    }

    modifier onlyParties(uint256 _escrowId) {
        if (msg.sender != escrows[_escrowId].buyer && msg.sender != escrows[_escrowId].seller) revert Unauthorized();
        _;
    }

    /**
     * @notice Initiates a new escrow agreement and locks the deposited ETH.
     * @param _seller The counterparty receiving funds upon successful completion.
     */
    function createEscrow(address _seller) external payable returns (uint256) {
        if (msg.value == 0) revert ValueCannotBeZero();
        if (_seller == address(0) || _seller == msg.sender) revert InvalidAddress();

        uint256 escrowId = escrowCounter;
        
        escrows[escrowId] = EscrowTransaction({
            buyer: msg.sender,
            seller: _seller,
            amount: msg.value,
            timestamp: block.timestamp,
            status: Status.Pending,
            evidenceHash: "",
            aiVerdict: ""
        });

        escrowCounter++;

        emit EscrowCreated(escrowId, msg.sender, _seller, msg.value);
        return escrowId;
    }

    /**
     * @notice Escalates the transaction status to Disputed.
     * @param _escrowId The unique target escrow identifier.
     * @param _evidenceHash The reference pointer for submitted documentation.
     */
    function dispute(uint256 _escrowId, string calldata _evidenceHash) external onlyParties(_escrowId) {
        EscrowTransaction storage item = escrows[_escrowId];
        if (item.status != Status.Pending) revert InvalidStatus();

        item.status = Status.Disputed;
        item.evidenceHash = _evidenceHash;

        emit EscrowDisputed(_escrowId, _evidenceHash);
    }

    /**
     * @notice Releases locked funds directly to the seller. 
     * @dev Can be invoked natively by the buyer or by the parties following an AI adjudication routing.
     */
    function releaseFunds(uint256 _escrowId, string calldata _aiVerdict) external onlyParties(_escrowId) {
        EscrowTransaction storage item = escrows[_escrowId];
        if (item.status != Status.Pending && item.status != Status.Disputed) revert InvalidStatus();

        item.status = Status.Released;
        item.aiVerdict = _aiVerdict;

        uint256 paymentAmount = item.amount;
        item.amount = 0; // Prevent Reentrancy

        (bool success, ) = payable(item.seller).call{value: paymentAmount}("");
        require(success, "Transfer failed");

        emit EscrowReleased(_escrowId, _aiVerdict);
    }

    /**
     * @notice Returns locked funds directly back to the buyer.
     * @dev Executed when an AI arbitration consensus validates a refund criteria.
     */
    function refundFunds(uint256 _escrowId, string calldata _aiVerdict) external onlyParties(_escrowId) {
        EscrowTransaction storage item = escrows[_escrowId];
        if (item.status != Status.Pending && item.status != Status.Disputed) revert InvalidStatus();

        item.status = Status.Refunded;
        item.aiVerdict = _aiVerdict;

        uint256 refundAmount = item.amount;
        item.amount = 0; // Prevent Reentrancy

        (bool success, ) = payable(item.buyer).call{value: refundAmount}("");
        require(success, "Transfer failed");

        emit EscrowRefunded(_escrowId, _aiVerdict);
    }

    /**
     * @notice Read helper to easily fetch transaction details for our UI hooks.
     */
    function getEscrowDetails(uint256 _escrowId) external view returns (EscrowTransaction memory) {
        return escrows[_escrowId];
    }
}