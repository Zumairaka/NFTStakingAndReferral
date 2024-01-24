//SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {Errors} from "../../libraries/Errors.sol";
import {Events} from "../../libraries/Events.sol";

/**
 * @notice NFTMinting contract
 * @author DigitalTrustCSP
 * @dev this contract is an upgradeable one which holds a nominee so that ownership
 * can be transferred to the nominee address whenever the owner wants to
 * @dev this contract mint the erc1155 tokens and only the owner can mint the tokens
 * @dev this contract has burn function which can be done only by the marketplace contract
 * @dev each token has a separate uris.
 */

contract NFTMinting is ERC1155Upgradeable, ReentrancyGuardUpgradeable {
    using CountersUpgradeable for CountersUpgradeable.Counter;

    /* State Variables */
    CountersUpgradeable.Counter private _tokenId;
    address private _owner;
    address private _nominee;
    address private _nftMarketplace;

    /* Modifiers */
    // modifier to check if the caller is owner
    modifier onlyOwner() {
        if (msg.sender != _owner) {
            revert Errors.NotOwner();
        }
        _;
    }

    // modifier to check if the caller is marketplace contract
    modifier onlyMarketplace() {
        if (msg.sender != _nftMarketplace) {
            revert Errors.NotMarketplaceContract();
        }
        _;
    }

    // modifier to check if the address is zero address
    modifier checkAddress(address account_) {
        if (account_ == address(0)) {
            revert Errors.ZeroAddress();
        }
        _;
    }

    /* Mappings */
    // tokenId => uri
    mapping(uint256 => string) _tokenUris;
    // uri => tokenId
    mapping(string => uint256) _tokenIds;
    // tokenId => totalSupply
    mapping(uint256 => uint256) private _totalSupply;
    // tokenId => totalBurnt
    mapping(uint256 => uint256) private _totalBurnt;

    /* Public Functions */
    /**
     * @notice this function for initializing the contract
     * @dev uri is set to null. Uri can be set at the time of minting
     */
    function initialize() public initializer checkAddress(msg.sender) {
        __ERC1155_init("");
        _owner = msg.sender;
    }

    /* Public View Functions */
    /**
     * @notice function for returning the uri of a token
     * @dev public function which override the uri function from ERC1155Upgradeable
     * @param tokenId_ token id
     * @return _uri uri of the token

     */
    function uri(uint256 tokenId_)
        public
        view
        override
        returns (string memory)
    {
        return _tokenUris[tokenId_];
    }

    /* External Functions */
    /**
     * @notice function for minting the NFTs
     * @dev increment the counter and create new tokenId if the uri is new
     * @dev assign the tokenuri against the tokenIds
     * @dev if the uri exist then fetch the tokenId and mint with that tokenId
     * @dev before minting make sure marketplace address exist
     * @param uri_ token uri
     * @param amount_ number of tokens to be minted
     * @dev emit an event TokenMinted
     */
    function mintNft(uint256 amount_, string memory uri_)
        external
        onlyOwner
        checkAddress(_nftMarketplace)
        nonReentrant
    {
        _checkAmount(amount_);
        if (bytes(uri_).length == 0) {
            revert Errors.InvalidUri();
        }

        uint256 tokenId_ = _tokenIds[uri_];

        // if tokenId exist mint with that tokenId
        if (tokenId_ == 0) {
            // create new token id
            _tokenId.increment();
            tokenId_ = _tokenId.current();

            // update mappings
            _tokenUris[tokenId_] = uri_;
            _tokenIds[uri_] = tokenId_;
            _totalSupply[tokenId_] += amount_;
        }

        // mint the token
        emit Events.TokenMinted(msg.sender, tokenId_, amount_);

        _setApprovalForAll(msg.sender, _nftMarketplace, true);
        _mint(msg.sender, tokenId_, amount_, "");
    }

    /**
     * @notice function for burning the NFTs
     * @param amount_ number of tokens to be burned
     * @param tokenId_ tokenId
     * @dev emit an event TokenBurnt
     */
    function burnNft(uint256 tokenId_, uint256 amount_)
        external
        onlyMarketplace
        nonReentrant
    {
        _checkAmount(amount_);
        if (balanceOf(msg.sender, tokenId_) < amount_) {
            revert Errors.NotEnoughBalanceToBurn();
        }

        // update mappings
        _totalSupply[tokenId_] -= amount_;
        _totalBurnt[tokenId_] += amount_;

        emit Events.TokenBurnt(msg.sender, tokenId_, amount_);
        _burn(msg.sender, tokenId_, amount_);
    }

    /* Owner's Functions */
    /**
     * @notice function for adding the nft marketplace address
     * @dev only owner can execute this function
     * @param matkeplaceAddress_  market place address
     */
    function addMarketplace(address matkeplaceAddress_)
        external
        onlyOwner
        checkAddress(matkeplaceAddress_)
    {
        if (matkeplaceAddress_ == _nftMarketplace) {
            revert Errors.MarketplaceAddressExist();
        }

        emit Events.MarketplaceAdded(matkeplaceAddress_);
        _nftMarketplace = matkeplaceAddress_;
    }

    /**
     * @notice function for adding the nominee
     * @dev only owner can add nominee
     * @dev this will avoid the owner changes the ownership to
     * an address which cannot initiate a transaction (for ex: smart contract address)
     * @dev nominee should accept the nomination. Only then ownership will be transferred
     * @dev emits an event NomineeAdded
     * @param nominee_ nominee address
     */
    function addNominee(address nominee_)
        external
        onlyOwner
        checkAddress(nominee_)
    {
        if (nominee_ == _owner) {
            revert Errors.OwnerCannotBeTheNominee();
        }
        if (nominee_ == _nominee) {
            revert Errors.AlreadyNominee();
        }

        _nominee = nominee_;
        emit Events.NomineeAdded(_owner, nominee_);
    }

    /**
     * @notice function for accepting the nomination
     * @dev only the nominee can call this function
     * @dev the ownership will be transferred
     * @dev emits an event OwnerChanged
     */
    function acceptNomination() external {
        if (msg.sender != _nominee) {
            revert Errors.NotNominee();
        }

        _owner = msg.sender;
        emit Events.OwnerChanged(msg.sender);
    }

    /* External View Functions */
    /**
     * @notice function for returning the owner
     * @dev external function
     * @return _owner current owner address
     */
    function owner() external view returns (address) {
        return _owner;
    }

    /**
     * @notice function for returning the nominee
     * @dev external function
     * @return _nominee current nominee address
     */
    function nominee() external view returns (address) {
        return _nominee;
    }

    /**
     * @notice function for retrieving the tokenId for a particular nft uri
     * @param uri_ uri of the nft
     */
    function tokenId(string memory uri_) external view returns (uint256) {
        if (_tokenIds[uri_] == 0) {
            revert Errors.TokenUriDoesNotExist();
        }

        return _tokenIds[uri_];
    }

    /**
     * @notice function for getting the total supply of the tokenIds
     * @param tokenId_ tokenId of the planet
     * @return _totalSupply total number of nfts minted for the particular tokenId
     */
    function totalSupply(uint256 tokenId_) external view returns (uint256) {
        return _totalSupply[tokenId_];
    }

    /**
     * @notice function for getting the total burnt amount of the tokenIds
     * @param tokenId_ tokenId of the planet
     * @return _totalBurnt total number of nfts burnt for the particular tokenId
     */
    function totalBurnt(uint256 tokenId_) external view returns (uint256) {
        return _totalBurnt[tokenId_];
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

    /* Private Functions */
    /**
     * @notice function for checking the amount
     * @param amount_ amount
     */
    function _checkAmount(uint256 amount_) private pure {
        if (amount_ == 0) {
            revert Errors.ZeroAmount();
        }
    }

    /* Private Function Ends */
}
