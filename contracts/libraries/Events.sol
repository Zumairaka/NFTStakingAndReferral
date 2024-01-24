// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

library Events {
    /* MARKETPLACE EVENTS */
    /**
     * @dev emitted when a Financial Instrument (FI) is created
     * @param itemId itemId of the FI
     * @param tokenId tokenId of the FI
     * @param noOfItems number of FI created
     * @param pricePerItem pricePerItem
     * @param rewardRate rewardRate for the FI
     * @param validity validity for the FI
     */
    event FinancialInstrumentCreated(
        uint256 indexed itemId,
        uint256 indexed tokenId,
        uint256 noOfItems,
        uint256 pricePerItem,
        uint256 rewardRate,
        uint256 validity
    );

    /**
     * @dev emitted when a Financial Instrument (FI) is sold
     * @param itemId itemId of the FI
     * @param tokenId tokenId of the FI
     * @param noOfItems number of FI sold
     * @param purchaseAmount total purchase amount
     * @param rewardRate rewardRate for the FI
     * @param validity validity for the FI
     * @param buyer buyer address for the FI
     */
    event FinancialInstrumentSold(
        uint256 indexed itemId,
        uint256 indexed tokenId,
        uint256 noOfItems,
        uint256 purchaseAmount,
        uint256 rewardRate,
        uint256 validity,
        address indexed buyer
    );

    /**
     * @dev emitted when the buyer withdraws the Financial Instrument capital
     * @param purchaseId purchaseId of the FI
     * @param capitalAmount total purchase amount for the purchaseId
     * @param penalty penalty for the early claim
     * @param reward reward remaining till the claim time
     */
    event CapitalWithdrawn(
        uint256 indexed purchaseId,
        uint256 capitalAmount,
        uint256 penalty,
        uint256 reward
    );

    /**
     * @dev emitted when a penalty is deducted during the early withdraw of the capital
     * @param itemId itemId of the FI
     * @param buyer buyer address
     * @param penalty penalty for the early claim of capital
     */
    event PenaltyDeducted(
        uint256 indexed itemId,
        address indexed buyer,
        uint256 penalty
    );

    /**
     * @dev emitted when the owner withdraws all the penalty amount from the smart contract
     * @param owner owner address
     * @param penalty total penalty amount
     */
    event PenaltyWithdrawn(address indexed owner, uint256 penalty);

    /**
     * @dev emitted when the owner withdraws all the Eth balance from the smart contract
     * @param owner owner address
     * @param balance total Eth balance
     */
    event ContractBalanceWithdrawn(address indexed owner, uint256 balance);

    /**
     * @dev emitted when the rewardis released
     * @dev this can happen during the purchase of the FI (for referrers),
     * withdrawing the capital and claim reward
     * @param purchaseId purchaseId for the FI
     * @param beneficiary beneficiary address
     * @param amount reward amount
     */
    event RewardReleased(
        uint256 indexed purchaseId,
        address indexed beneficiary,
        uint256 amount
    );

    /**
     * @notice emitted when the smart contract receives any eth sent by any account by mistake
     * @dev during receive function
     * @param sender sender address
     * @param amount eth amount received
     */
    event EthReceived(address indexed sender, uint256 amount);

    /**
     * @notice emitted when the referrer is added by a user
     * @dev during add referrer function
     * @param sender sender address
     * @param referrer referrer address who referred the sender
     */
    event AddedReferrer(address indexed sender, address indexed referrer);

    /* MINTING EVENTS*/
    /**
     * @notice emitted when the marketplace address is added by the owner
     * @param marketplace marketplace address
     */
    event MarketplaceAdded(address indexed marketplace);

    /**
     * @notice emitted when the token is minted by the owner
     * @param owner owner address
     * @param tokenId tokenId
     * @param amount number of tokens minted
     */
    event TokenMinted(
        address indexed owner,
        uint256 indexed tokenId,
        uint256 amount
    );

    /**
     * @notice emitted when the token is burned by the owner
     * @param owner owner address
     * @param tokenId tokenId
     * @param amount number of tokens burnt
     */
    event TokenBurnt(
        address indexed owner,
        uint256 indexed tokenId,
        uint256 amount
    );

    /* GENERAL EVENTS */
    /**
     * @notice emitted when the nominee is added by the owner
     * @param owner owner address
     * @param nominee nominee address
     */
    event NomineeAdded(address indexed owner, address indexed nominee);

    /**
     * @notice emitted when the owner is modified
     * @dev it happens when the nominee accept nomination
     * @param owner new owner address
     */
    event OwnerChanged(address indexed owner);

    /* DOUBLE FI TOKEN EVENTS */
    /**
     * @notice emitted when the DoubleFi token is minted
     * @param account address to which the token is minted
     * @param amount amount of tokens to be minted
     */
    event DoubleFiTokenMinted(address indexed account, uint256 amount);

    /**
     * @notice emitted when the DoubleFi token is burnt
     * @param amount amount of tokens to be burned
     */
    event DoubleFiTokenBurnt(uint256 amount);
}
