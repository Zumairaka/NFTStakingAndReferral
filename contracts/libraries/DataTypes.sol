// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

library DataTypes {
    // strcut for storing the financial instrument data
    struct FinancialInstrument {
        uint256 tokenId;
        uint256 noOfItems;
        uint256 pricePerItem;
        uint256 rewardRate;
        uint256 itemSold;
        uint256 itemBurnt;
        uint256 validity;
    }

    // struct for storing the purchase details
    struct PurchaseData {
        uint256 itemId;
        uint256 noOfItems;
        uint256 purchaseAmount;
        uint256 unlockTime;
        address buyer;
    }

    // struct for storing the referral reward details
    struct RewardData {
        uint256 rewardPerSecond;
        uint256 lastClaimTime;
        uint256 totalReward;
    }
}
