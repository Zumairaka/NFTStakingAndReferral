// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../minting/NFTMinting.sol";

import {Events} from "../../libraries/Events.sol";
import {Errors} from "../../libraries/Errors.sol";
import {DataTypes} from "../../libraries/DataTypes.sol";
import {Helpers} from "../../libraries/Helpers.sol";
import {Constants} from "../../libraries/Constants.sol";

import "hardhat/console.sol";

/**
 * @notice Marketplace contract where we can buy tokens and
 * earn rewards based on staking percentage. Some rewards will be given
 * to the referred person as well. Here the following features are done
 * Buy NFT
 * Set Referral
 * Compute Rewards
 * Burn Token
 * Send Reward to Wallet
 * @author Sumaira
 * @dev USDT is used for payment. The contract addresses are as follows
 * BSCTestnet: 0x337610d27c682E347C9cD60BD4b3b107C9d34dDd
 */

contract NFTMarketplace is
    ERC1155Upgradeable,
    ERC1155HolderUpgradeable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable
{
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /* State Variables */
    CountersUpgradeable.Counter private _itemId;
    CountersUpgradeable.Counter private _purchaseId;
    uint256 private _collectedPenalty;
    uint256 private _totalPurchasedAmount;
    uint256 private _totalExpectedReward;
    uint256 private _totalRewardPool;
    NFTMinting private _nftContract;
    IERC20Upgradeable private _tokenContract; // USDT

    /* Mappings */
    // itemId => FinancialInstrument
    mapping(uint256 => DataTypes.FinancialInstrument)
        public _financialInstrument;

    // purchaseId => PurchaseData
    mapping(uint256 => DataTypes.PurchaseData) public _purchaseData;

    // user => referrer
    mapping(address => address) public _referrer;

    // user => reward data
    mapping(address => DataTypes.RewardData) private _rewardData;

    // purchaseId => user => rewardPerSecond
    mapping(uint256 => mapping(address => uint256)) private _rewardPerPurchase;

    /* Public Functions */

    function initialize(
        address nftContract_,
        address tokenContract_
    ) public initializer {
        Helpers._checkAddress(nftContract_);
        Helpers._checkAddress(tokenContract_);

        __ERC1155Holder_init();
        __ReentrancyGuard_init();
        __Ownable_init();

        // _owner = msg.sender;
        _nftContract = NFTMinting(nftContract_);
        _tokenContract = IERC20Upgradeable(tokenContract_);
    }

    /**
     * @dev function for making the contract ERC1155 receiver
     */
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        virtual
        override(ERC1155Upgradeable, ERC1155ReceiverUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /* Public Function Ends */

    /* External Functions */

    /* Owner Functions */

    /**
     * @notice function for creating the financial instrument
     * @dev update the financial instrument data
     * @param tokenId token id of the NFT
     * @param noOfItems number of items
     * @param pricePerItem price of the NFT per item
     * @param rewardRate reward rate for this NFT
     * @param validity validity of the NFT in seconds
     */
    function createFinancialInstrument(
        uint256 tokenId,
        uint256 noOfItems,
        uint256 pricePerItem,
        uint256 rewardRate,
        uint256 validity
    ) external onlyOwner {
        Helpers._checkAmount(noOfItems);
        Helpers._checkAmount(pricePerItem);
        Helpers._checkAmount(validity);
        Helpers._checkRate(rewardRate);

        // check for the balance with the financial instrument creator
        if (_nftContract.balanceOf(msg.sender, tokenId) < noOfItems) {
            revert Errors.InSufficientNFTBalance();
        }

        // create financial instrument
        _itemId.increment();
        uint256 itemId = _itemId.current();

        DataTypes.FinancialInstrument
            memory financialInstrument = _financialInstrument[itemId];
        financialInstrument.tokenId = tokenId;
        financialInstrument.noOfItems = noOfItems;
        financialInstrument.itemSold = 0;
        financialInstrument.pricePerItem = pricePerItem;
        financialInstrument.rewardRate = rewardRate;
        financialInstrument.validity = validity;

        _financialInstrument[itemId] = financialInstrument;
        emit Events.FinancialInstrumentCreated(
            itemId,
            tokenId,
            noOfItems,
            pricePerItem,
            rewardRate,
            validity
        );

        // transfer the NFT to the marketplace contract
        _nftContract.safeTransferFrom(
            msg.sender,
            address(this),
            tokenId,
            noOfItems,
            ""
        );
    }

    /**
     * @notice function for withdrawing the smart contract token balance
     * @dev this function will ensure not token is getting stucked in the smart contract
     * @dev only owner can access this function
     */
    function withdrawBalance() external onlyOwner nonReentrant {
        uint256 balance_ = _getBalance();

        if (balance_ == 0) {
            revert Errors.InsufficientTokenBalance();
        }

        // emit event and transfer balance
        emit Events.ContractBalanceWithdrawn(msg.sender, balance_);
        _tokenContract.safeTransfer(msg.sender, balance_);
    }

    /**
     * @notice function for withdrawing the penalty
     * @dev only owner can access this function
     */
    function withdrawPenalty() external onlyOwner nonReentrant {
        uint256 penalty = _collectedPenalty;
        if (penalty == 0) {
            revert Errors.ZeroPenaltyBalance();
        }

        // emit event and transfer balance
        _collectedPenalty = 0;

        emit Events.PenaltyWithdrawn(msg.sender, penalty);
        _tokenContract.safeTransfer(msg.sender, penalty);
    }

    /* Owner Function Ends */

    /**
     * @notice function for setting the referrer
     * @dev check if referrer exist. Only if not assign the referrer
     * @param referrer_ address of the referrer
     */
    function addReferrer(address referrer_) external {
        Helpers._checkAddress(msg.sender);
        Helpers._checkAddress(referrer_);

        if (_referrer[msg.sender] != address(0)) {
            revert Errors.ReferrerAlreadyExist();
        }

        emit Events.AddedReferrer(msg.sender, referrer_);
        _referrer[msg.sender] = referrer_;
    }

    /**
     * @notice function for buying the financial instrument
     * @dev update the purchase data.
     * @dev fetch the referral details for the buyer and send 1.5% reward to the first referrer
     * @dev send 1% to the second referrer and send 0.5% to the third referrer.
     * @dev recrod details for the reward per second for each beneficiary to giving the same
     * rewards till the expiration time.
     * @dev record reward date for each beneficiary to reflect the total reward and total reward
     * per second based on the new purchase.
     * @dev check the reward pool for the balance for releasing the purchase rewards
     * for the beneficiaries.
     * @param itemId itemId of the financial instrument
     * @param noOfItems number of items
     */
    function buyFinancialInstrument(
        uint256 itemId,
        uint256 noOfItems
    ) external nonReentrant {
        Helpers._checkAddress(msg.sender);

        // fetch the financial instrument data
        DataTypes.FinancialInstrument memory fi = _financialInstrument[itemId];

        // check for enough NFT balance
        if (fi.noOfItems - fi.itemSold < noOfItems) {
            revert Errors.InsufficientFinancialInstrumentBalance();
        }

        // check for the purchaser's USDT balance
        uint256 purchaseAmount = fi.pricePerItem * noOfItems;
        if (purchaseAmount > _tokenContract.balanceOf(msg.sender)) {
            revert Errors.InsufficientTokenBalance();
        }

        // increment purchase Id
        _purchaseId.increment();
        uint256 purchaseId = _purchaseId.current();

        // compute the reward per seconds for the purchaser every month
        //  rate is fi.rewardRate but for phase 1 its fixed as 5%
        _updateRewards(
            msg.sender,
            purchaseId,
            purchaseAmount,
            Constants.PURCHASER_REWARD,
            fi.validity
        );

        // compute the referrer rewards
        (
            uint256 ref1Reward,
            uint256 ref2Reward,
            uint256 ref3Reward,
            address ref1,
            address ref2,
            address ref3
        ) = _processReferrerRewards(
                purchaseId,
                purchaseAmount,
                fi.validity,
                false
            );

        // to avoid stack too deep
        {
            // update the purchase data
            DataTypes.PurchaseData memory purchaseData = _purchaseData[
                purchaseId
            ];
            purchaseData.buyer = msg.sender;
            purchaseData.itemId = itemId;
            purchaseData.noOfItems = noOfItems;
            purchaseData.purchaseAmount = purchaseAmount;
            purchaseData.unlockTime = block.timestamp + fi.validity;
            _purchaseData[purchaseId] = purchaseData;

            // update financial instrument data
            fi.itemSold += noOfItems;
            _financialInstrument[itemId] = fi;

            // update total purchase amount
            _totalPurchasedAmount += purchaseAmount;

            emit Events.FinancialInstrumentSold(
                itemId,
                fi.tokenId,
                noOfItems,
                purchaseAmount,
                fi.rewardRate,
                purchaseData.unlockTime,
                msg.sender
            );

            // transfer the NFTs to the purchaser
            _nftContract.safeTransferFrom(
                address(this),
                msg.sender,
                fi.tokenId,
                noOfItems,
                ""
            );

            // transfer purchase amount to the owner address
            _tokenContract.safeTransferFrom(
                msg.sender,
                owner(),
                purchaseAmount
            );

            // trnasfer all the referrer rewards
            if (ref1Reward > 0) {
                _tokenContract.safeTransfer(ref1, ref1Reward);
                if (ref2Reward > 0) {
                    _tokenContract.safeTransfer(ref2, ref2Reward);
                    if (ref3Reward > 0) {
                        _tokenContract.safeTransfer(ref3, ref3Reward);
                    }
                }
            }
        }
    }

    /**
     * @notice function for returning the financial instrument and claiming their capital
     * @dev the purchaser can claim their capital only after returning their FI and burn the NFT
     * @dev if they are returning the FI before the validity expires 40% penalty has to be deducted
     * @param purchaseId purchasedId for the FI
     */
    function withdrawCapital(uint256 purchaseId) external nonReentrant {
        DataTypes.PurchaseData memory purchaseData = _purchaseData[purchaseId];
        DataTypes.FinancialInstrument memory fi = _financialInstrument[
            purchaseData.itemId
        ];
        uint256 noOfItems = purchaseData.noOfItems;

        // check if the caller is the purchaser
        if (purchaseData.buyer != msg.sender) {
            revert Errors.UnauthorizedAccess();
        }

        // check of the purchaser has enough FI balance to return
        if (_nftContract.balanceOf(msg.sender, fi.tokenId) != noOfItems) {
            revert Errors.NotEnoughFinancialInstrumentToReturn();
        }

        uint256 purchaserAmount;
        (uint256 penalty, uint256 reward) = _getPenaltyAndRewards(
            msg.sender,
            purchaseId,
            purchaseData.purchaseAmount,
            purchaseData.unlockTime
        );

        // check reward pool
        _checkPool(reward);

        // deduct penalty
        if (penalty > 0) {
            purchaserAmount = purchaseData.purchaseAmount - penalty;
            _collectedPenalty += penalty;

            emit Events.PenaltyDeducted(
                purchaseData.itemId,
                msg.sender,
                penalty
            );
        } else {
            purchaserAmount = purchaseData.purchaseAmount;
        }

        // check purchase balance
        if (_getBalance() < purchaserAmount) {
            revert Errors.InsufficientBalanceForWithdrawingCapital();
        }
        // _checkPurchaseBalancePool(purchaserAmount);

        // remaining reward for the referrers
        (
            uint256 ref1Reward,
            uint256 ref2Reward,
            uint256 ref3Reward,
            address ref1,
            address ref2,
            address ref3
        ) = _processReferrerRewards(
                purchaseId,
                purchaseData.purchaseAmount,
                purchaseData.unlockTime,
                true
            );

        // update collected penalty, total reward pool, total expected reward pool and total purchased amount
        // _totalRewardPool -= reward;
        _totalPurchasedAmount -= purchaseData.purchaseAmount;

        // update FI data
        fi.itemBurnt += noOfItems;
        _financialInstrument[purchaseData.itemId] = fi;

        // delete purchase data
        delete _purchaseData[purchaseId];

        emit Events.CapitalWithdrawn(
            purchaseId,
            purchaserAmount,
            penalty,
            reward
        );

        // transfer the FI back to the smart contract
        _nftContract.safeTransferFrom(
            msg.sender,
            address(this),
            fi.tokenId,
            noOfItems,
            ""
        );

        // burn the FI
        _nftContract.burnNft(fi.tokenId, purchaseData.noOfItems);

        // trnasfer the purchaser rewards and capital
        _tokenContract.safeTransfer(msg.sender, (purchaserAmount + reward));

        // transfer referrers rewards
        if (ref1Reward > 0) {
            _tokenContract.safeTransfer(ref1, ref1Reward);
            if (ref2Reward > 0) {
                _tokenContract.safeTransfer(ref2, ref2Reward);
                if (ref3Reward > 0) {
                    _tokenContract.safeTransfer(ref3, ref3Reward);
                }
            }
        }
    }

    /**
     * @notice function for claiming the rewards
     * @dev rewards can be given based on the reward data record
     * @dev duration has to be calculated from last claim time to the current
     * and then release reward for that duration
     * @dev the reward should not exceed the total reward recorded for the user
     */
    function claimReward() external nonReentrant {
        DataTypes.RewardData memory rewardData = _rewardData[msg.sender];

        if (rewardData.totalReward == 0) {
            revert Errors.NoRewardBalance();
        }

        // compute the reward
        uint256 reward = rewardData.rewardPerSecond *
            (block.timestamp - rewardData.lastClaimTime);

        // if this reward is greater than the total; reward should be the amount left
        if (reward > rewardData.totalReward) {
            reward = rewardData.totalReward;
        }

        // update the total rewardpool and total expected reward
        _totalExpectedReward -= reward;
        // _totalRewardPool -= reward;

        // update the reward data record
        rewardData.lastClaimTime = block.timestamp;
        rewardData.totalReward -= reward;
        _rewardData[msg.sender] = rewardData;

        // check the pool balance
        _checkPool(reward);

        emit Events.RewardReleased(0, msg.sender, reward);

        // trnasfer the reward to the user
        _tokenContract.safeTransfer(msg.sender, reward);
    }

    /* External View Functions */

    // /**
    //  * @notice function for returning the referrer address
    //  * @dev external function
    //  * @param account address of account whose referrer has to be returned
    //  * @return _referrer referrer address
    //  */
    // function referrer(address account) external view returns (address) {
    //     return _referrer[account];
    // }

    /**
     * @notice function for returning the collected penalty value
     * @dev external function
     * @return _collectedPenalty total collected penalty amount
     */
    function collectedPenalty() external view returns (uint256) {
        return _collectedPenalty;
    }

    /**
     * @notice function for returning the total purchase amount by all the users
     * @dev external function
     * @return _totalPurchasedAmount total purchase amount
     */
    function totalPurchasedAmount() external view returns (uint256) {
        return _totalPurchasedAmount;
    }

    /**
     * @notice function for returning the total expected reward for all the users
     * @dev external function
     * @return _totalExpectedReward total expected reward for all the users including referrers
     */
    function totalExpectedReward() external view returns (uint256) {
        return _totalExpectedReward;
    }

    /**
     * @notice function for returning the existing reward pool amount
     * @dev external function
     * @return _totalRewardPool current total reward pool amount
     */
    function totalRewardPool() external view returns (uint256) {
        return _totalRewardPool;
    }

    /* External Function Ends */

    /* Private Helper Functions */

    /**
     * @notice function for computing the referrer and purchaser rewards
     * if this is called from "buyFinancialInstrument" and, for computing
     * the penalty and remaining rewards for the purchaser and referrer
     * if this is called from "withdrawCapital"
     * @dev private helper function which will be called from 2 functions
     * @dev based on the flag value "withdraw" different sub functions will be called
     * @dev if the "withdraw" is false it will call "_updateRewards"
     * @dev if the "withdraw" is true it will call "_getPenaltyAndRewards"
     * @param purchaseId purchaseId
     * @param purchaseAmount total purchaseAmount
     * @param duration validity of FI incase the call is from "buyFinancialInstrument"
     * and unlock time of the purchase in case the call is from "withdrawCapital"
     * @param withdraw flag; false the call is from "purchase", true the call is from "withdraw"
     * @return ref1Reward reward for referrer1
     * @return ref2Reward reward for referrer2
     * @return ref3Reward reward for referrer3
     * @return ref1 address of referrer1
     * @return ref2 address of referrer2
     * @return ref3 address of referrer3
     */
    function _processReferrerRewards(
        uint256 purchaseId,
        uint256 purchaseAmount,
        uint256 duration,
        bool withdraw
    )
        private
        returns (
            uint256 ref1Reward,
            uint256 ref2Reward,
            uint256 ref3Reward,
            address ref1,
            address ref2,
            address ref3
        )
    {
        // fetch the referrer details
        ref1 = _referrer[msg.sender];
        if (ref1 != address(0)) {
            ref2 = _referrer[ref1];
            if (ref2 != address(0)) {
                ref3 = _referrer[ref2];
            }
        }
        uint256 totalReward;

        // compute the reward per seconds for the referrer1 every month and transfer the amount
        //  rate for phase 1 its fixed as 1.5%
        if (ref1 != address(0)) {
            (, ref1Reward) = !withdraw
                ? _updateRewards(
                    ref1,
                    purchaseId,
                    purchaseAmount,
                    Constants.REFERRER1_REWARD,
                    duration
                )
                : _getPenaltyAndRewards(
                    ref1,
                    purchaseId,
                    purchaseAmount,
                    duration
                );
            totalReward += ref1Reward;
            emit Events.RewardReleased(purchaseId, ref1, ref1Reward);

            if (ref2 != address(0)) {
                // compute the reward per seconds for the referrer2 every month
                //  rate for phase 1 its fixed as 1%
                (, ref2Reward) = !withdraw
                    ? _updateRewards(
                        ref2,
                        purchaseId,
                        purchaseAmount,
                        Constants.REFERRER2_REWARD,
                        duration
                    )
                    : _getPenaltyAndRewards(
                        ref2,
                        purchaseId,
                        purchaseAmount,
                        duration
                    );
                totalReward += ref2Reward;
                emit Events.RewardReleased(purchaseId, ref2, ref2Reward);

                if (ref3 != address(0)) {
                    // compute the reward per seconds for the referrer3 every month
                    //  rate for phase 1 its fixed as 0.5%
                    (, ref3Reward) = !withdraw
                        ? _updateRewards(
                            ref3,
                            purchaseId,
                            purchaseAmount,
                            Constants.REFERRER3_REWARD,
                            duration
                        )
                        : _getPenaltyAndRewards(
                            ref3,
                            purchaseId,
                            purchaseAmount,
                            duration
                        );
                    totalReward += ref3Reward;
                    emit Events.RewardReleased(purchaseId, ref3, ref3Reward);
                }
            }
        }

        // check if reward pool has enough balance for total rewards
        _checkPool(totalReward);

        // update total reward pool
        // _totalRewardPool -= totalReward;

        return (ref1Reward, ref2Reward, ref3Reward, ref1, ref2, ref3);
    }

    /**
     * @notice function for computing the reward details and update the records
     * @param beneficiary beneficiary of the reward
     * @param purchaseId purchaseId of the financial instrument
     * @param amount purchase amount of the financial instrument
     * @param rate reward rate of the financial instrument
     * @param validity validity of the financial instrument in seconds
     */
    function _updateRewards(
        address beneficiary,
        uint256 purchaseId,
        uint256 amount,
        uint256 rate,
        uint256 validity
    ) private returns (uint256, uint256 rewardToSend) {
        rewardToSend = (amount * rate) / 10000;
        uint256 rewardPerSecond = rewardToSend / 30 days;
        uint256 totalReward = rewardPerSecond * validity;

        // update the rewardData for the beneficiary
        DataTypes.RewardData memory rewardData = _rewardData[beneficiary];
        rewardData.rewardPerSecond += rewardPerSecond;
        rewardData.totalReward += totalReward;
        // if the reward data is updating for the first time
        if (rewardData.lastClaimTime == 0) {
            rewardData.lastClaimTime = block.timestamp;
        }
        _rewardData[beneficiary] = rewardData;

        // update reward per second for this purchaseId
        _rewardPerPurchase[purchaseId][beneficiary] = rewardPerSecond;

        // update total expected reward
        _totalExpectedReward += totalReward;

        if (beneficiary == msg.sender) {
            rewardToSend = 0;
        }

        return (0, rewardToSend);
    }

    /**
     * @notice function for computing the penalty and rewards
     * @dev 40% penalty is deducted if returning before the unlock time
     * @param purchaseId purchaseId of the FI
     * @param purchaseAmount total amount of the FI
     * @param unlockTime expiration time of the FI
     * @return penalty penalty if returning earlier
     * @return reward unclaimed reward for the purchase
     */
    function _getPenaltyAndRewards(
        address beneficiary,
        uint256 purchaseId,
        uint256 purchaseAmount,
        uint256 unlockTime
    ) private returns (uint256 penalty, uint256 reward) {
        // fetch Total reward data for the purchaser
        DataTypes.RewardData memory rewardData = _rewardData[beneficiary];

        // fetch the reward per second for this particular purchase
        uint256 rewardPerSecond = _rewardPerPurchase[purchaseId][beneficiary];

        // compute the interval
        uint256 interval;
        uint256 unSpentReward;

        if (block.timestamp < unlockTime) {
            // for the purchaser find penalty
            if (beneficiary == msg.sender) {
                penalty = (purchaseAmount * Constants.PENALTY_RATE) / 10000;
            }

            interval = block.timestamp - rewardData.lastClaimTime;
            uint256 unSpentInterval = unlockTime - block.timestamp;

            // compute unspent reward
            unSpentReward = Helpers._getTotalReward(
                rewardPerSecond,
                unSpentInterval
            );
        } else {
            interval = unlockTime - rewardData.lastClaimTime;
        }

        // compute rewards
        reward = Helpers._getTotalReward(rewardPerSecond, interval);
        unSpentReward += reward;

        // update the reward details
        delete _rewardPerPurchase[purchaseId][beneficiary];
        rewardData.rewardPerSecond -= rewardPerSecond;
        rewardData.totalReward -= unSpentReward;
        _rewardData[beneficiary] = rewardData;

        // update the total expected reward
        _totalExpectedReward -= unSpentReward;

        return (penalty, reward);
    }

    /**
     * @notice this function is for checking the reward pool balance
     * @param amount reward amount
     */
    function _checkPool(uint256 amount) private view {
        if (_getBalance() < amount) {
            revert Errors.InsufficientBalanceInRewardPool();
        }
    }

    /**
     * @notice this function is for returning the contract's token balance
     * @return balance reward amount
     */
    function _getBalance() private view returns (uint256) {
        return _tokenContract.balanceOf(address(this));
    }

    // /**
    //  * @notice this function is for checking the purchase amount balance
    //  * @param amount reward amount
    //  */
    // function _checkPurchaseBalancePool(uint256 amount) private view {
    //     // uint256 poolBalance = _tokenContract.balanceOf(address(this)) -
    //     //     _totalRewardPool;

    //     if (_tokenContract.balanceOf(address(this)) < amount) {
    //         revert Errors.InsufficientBalanceForWithdrawingCapital();
    //     }
    // }

    /* Private Helper Function Ends */
}
