// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract USDTToken is ERC20Upgradeable, OwnableUpgradeable {
    function initialize() public initializer {
        __ERC20_init("USDT Token", "USDT");
        __Ownable_init();
        _mint(owner(), 10000 * 10**uint256(decimals()));
    }

    function mint(address account, uint256 amount) external onlyOwner {
        _mint(account, amount);
    }
}
