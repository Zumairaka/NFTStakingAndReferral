// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {Helpers} from "../../libraries/Helpers.sol";
import {Errors} from "../../libraries/Errors.sol";
import {Events} from "../../libraries/Events.sol";

contract DoubleFi is
    ERC20Upgradeable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable
{
    /* State Variables */
    address private _nftMarketplace;

    /* Modifiers */
    // modifier for authorizing the mint and burn (only owner or market place addresses)
    modifier authorize() {
        if (msg.sender != owner() && msg.sender != _nftMarketplace) {
            revert Errors.NotOwner();
        }
        _;
    }

    /* Public Functions */
    /**
     * @notice this function for initializing the contract
     * @dev uri is set to null. Uri can be set at the time of minting
     */
    function initialize() public initializer {
        __ReentrancyGuard_init();
        __ERC20_init("DoubleFi Token", "DBFI");
        __Ownable_init();

        // initial supply for 100M DoubleFi Tokens
        _mint(owner(), 100000000 * 10**uint256(decimals()));
    }

    /* Public Function Ends */

    /* External Functions */
    /**
     * @notice function for minting the new DoubleFi tokens
     * @dev only owner or nftmarketplace address can mint tokens
     * @param account account address to which the token has to be minted
     * @param amount amount of tokens to be minted
     */
    function mint(address account, uint256 amount)
        external
        authorize
        nonReentrant
    {
        Helpers._checkAddress(account);
        Helpers._checkAmount(amount);

        // mint tokens to the account
        emit Events.DoubleFiTokenMinted(account, amount);
        _mint(account, amount);
    }

    /**
     * @notice function for burning the new DoubleFi tokens
     * @dev only owner or nftmarketplace address can burn tokens
     * @param amount amount of tokens to be burned
     */
    function burn(uint256 amount) external authorize nonReentrant {
        Helpers._checkAmount(amount);

        // check balance
        if (balanceOf(msg.sender) < amount) {
            revert Errors.NotEnoughBalanceToBurn();
        }

        // burn tokens
        emit Events.DoubleFiTokenBurnt(amount);
        _burn(msg.sender, amount);
    }

    /**
     * @notice function for adding the nft marketplace address
     * @dev only owner can execute this function
     * @param matkeplaceAddress_  market place address
     */
    function addMarketplace(address matkeplaceAddress_) external onlyOwner {
        Helpers._checkAddress(matkeplaceAddress_);

        if (matkeplaceAddress_ == _nftMarketplace) {
            revert Errors.MarketplaceAddressExist();
        }

        emit Events.MarketplaceAdded(matkeplaceAddress_);
        _nftMarketplace = matkeplaceAddress_;
    }

    /**
     * @notice function for returning the market place address
     * @dev external function
     * @return _nftMarketplace current market place address
     */
    function nftMarketplace() external view returns (address) {
        return _nftMarketplace;
    }

    /* External Function Ends */
}
