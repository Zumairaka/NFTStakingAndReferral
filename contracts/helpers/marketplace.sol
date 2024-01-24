// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import {Events} from "../libraries/Events.sol";

/**
 * @notice demo marketplace contract to test the burn and mint of
 * both DoubleFi tokens and solar minting
 */

contract Marketplace is ERC1155Upgradeable, ERC1155HolderUpgradeable {
    
    /**
     * @dev function for making the contract ERC1155 receiver
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155Upgradeable, ERC1155ReceiverUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @notice receive() function
     */
    receive() external payable {
        emit Events.EthReceived(msg.sender, msg.value);
    }

}
