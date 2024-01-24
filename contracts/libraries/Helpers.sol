// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {DataTypes} from "./DataTypes.sol";
import {Errors} from "./Errors.sol";

library Helpers {
    /**
     * @notice function for computing the total Reward
     * @param rewardPerSecond reward per second for the purchase
     * @param interval duration for the reward
     * @return totalReward total reward
     */
    function _getTotalReward(uint256 rewardPerSecond, uint256 interval)
        internal
        pure
        returns (uint256 totalReward)
    {
        totalReward = rewardPerSecond * interval;
    }

    /**
     * @notice function to check if the address is zero address
     * @param account_ account address which has to be tested
     */
    function _checkAddress(address account_) internal pure {
        if (account_ == address(0)) {
            revert Errors.ZeroAddress();
        }
    }

    /**
     * @notice function to check if the amount is zero
     * @param amount_ amount
     */
    function _checkAmount(uint256 amount_) internal pure {
        if (amount_ == 0) {
            revert Errors.ZeroAmount();
        }
    }

    /**
     * @notice function to check if the rate is valid (between 0 and 10000)
     * @param rate_ rate
     */
    function _checkRate(uint256 rate_) internal pure {
        if (rate_ <= 0 || rate_ > 10000) {
            revert Errors.InvalidRate();
        }
    }
}
