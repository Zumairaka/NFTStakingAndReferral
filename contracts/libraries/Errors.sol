// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

library Errors {
    /* NFT Marketplace */
    error InvalidRate();
    error ReferrerAlreadyExist();
    error InSufficientNFTBalance();
    error InsufficientFinancialInstrumentBalance();
    error InsufficientTokenBalance();
    error InsufficientCoinBalance();
    error UnauthorizedAccess();
    error NotEnoughFinancialInstrumentToReturn();
    error NoRewardBalance();
    error TransferNotDone();
    error ZeroPenaltyBalance();
    error InsufficientBalanceInRewardPool();
    error InsufficientBalanceForWithdrawingCapital();

    /* NFT Minting */
    error NotMarketplaceContract();
    error InvalidUri();
    error NotEnoughBalanceToBurn();
    error MarketplaceAddressExist();
    error TokenUriDoesNotExist();
    error OwnerCannotBeTheNominee();
    error NotNominee();
    error AlreadyNominee();
    error NotOwner();

    /* General */
    error ZeroAddress();
    error ZeroAmount();
}
