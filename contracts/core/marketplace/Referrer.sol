// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {Events} from "../../libraries/Events.sol";
import {Errors} from "../../libraries/Errors.sol";
import {Helpers} from "../../libraries/Helpers.sol";

contract Referrer {
    // user => referrer
    mapping(address => address) public _referrer;

    /**
     * @notice function for setting the referrer
     * @dev check if referrer exist. Only if not assign the referrer
     * @param referrer_ address of the referrer
     */
    function addReferrer(address referrer_) public {
        Helpers._checkAddress(msg.sender);
        Helpers._checkAddress(referrer_);

        if (_referrer[msg.sender] != address(0)) {
            revert Errors.ReferrerAlreadyExist();
        }

        emit Events.AddedReferrer(msg.sender, referrer_);
        _referrer[msg.sender] = referrer_;
    }

    /**
     * @notice function for returning the referrer details
     * @param purchaser purchaser of the financial instrument
     * @return ref1 1st referrer
     * @return ref2 2nd referrer
     * @return ref3 3rd referrer
     */
    function _getReferrers(address purchaser)
        public
        view
        returns (
            address ref1,
            address ref2,
            address ref3
        )
    {
        ref1 = _referrer[purchaser];
        if (ref1 != address(0)) {
            ref2 = _referrer[ref1];
            if (ref2 != address(0)) {
                ref3 = _referrer[ref2];
            }
        }
    }
}
