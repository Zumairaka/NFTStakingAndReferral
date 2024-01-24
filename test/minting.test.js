require("@openzeppelin/hardhat-upgrades");

const { ethers, upgrades, network } = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { constants } = require("@openzeppelin/test-helpers");
const expectEvent = require("@openzeppelin/test-helpers/src/expectEvent");

describe("NFTMinting", () => {
  let admin,
    add1,
    add2,
    NFTMinting,
    nftMinting,
    NFTMarketplace,
    nftMarketplace,
    Events,
    events;
  let uri = "https://arweave.net/eR4wgSnWusIG-xF2BZzsiOwVehQsvfCT8VAUC4NHQ5Y";

  beforeEach(async () => {
    // initialize the signers
    [admin, add1, add2, _] = await ethers.getSigners();

    // deploy the contract using proxy
    NFTMinting = await ethers.getContractFactory("NFTMinting");
    nftMinting = await upgrades.deployProxy(NFTMinting, {
      initializer: "initialize",
    });
    await nftMinting.deployed();

    NFTMarketplace = await ethers.getContractFactory("Marketplace");
    nftMarketplace = await NFTMarketplace.deploy();

    // deploy events library
    Events = await ethers.getContractFactory("Events");
    events = await Events.deploy();
  });

  describe("Owner", () => {
    it("Should set the right owner", async () => {
      expect(await nftMinting.owner()).to.equal(admin.address);
    });
  });

  describe("Add Nominee", () => {
    it("Should revert if the txn is not by the owner", async () => {
      await expect(
        nftMinting.connect(add2).addNominee(add1.address)
      ).to.be.revertedWith("NotOwner");
    });

    it("Should revert if the nominee is zero address", async () => {
      await expect(
        nftMinting.connect(admin).addNominee(constants.ZERO_ADDRESS)
      ).to.be.revertedWith("ZeroAddress");
    });

    it("Should revert if the nominee is same as the owner", async () => {
      await expect(
        nftMinting.connect(admin).addNominee(admin.address)
      ).to.be.revertedWith("OwnerCannotBeTheNominee");
    });

    it("Should revert if the nominee is same as before", async () => {
      await nftMinting.connect(admin).addNominee(add1.address);

      await expect(
        nftMinting.connect(admin).addNominee(add1.address)
      ).to.be.revertedWith("AlreadyNominee");
    });

    it("Should add nominee by the owner", async () => {
      await nftMinting.connect(admin).addNominee(add1.address);
      expect(await nftMinting.nominee()).to.equal(add1.address);
    });
  });

  describe("Add Nft Marketplace Address", () => {
    it("Should revert if the txn is not by the owner", async () => {
      await expect(
        nftMinting.connect(add2).addMarketplace(nftMarketplace.address)
      ).to.be.revertedWith("NotOwner");
    });

    it("Should revert if the marketplace address is zero address", async () => {
      await expect(
        nftMinting.connect(admin).addMarketplace(constants.ZERO_ADDRESS)
      ).to.be.revertedWith("ZeroAddress");
    });

    it("Should revert if the contract address already exist", async () => {
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      await expect(
        nftMinting.connect(admin).addMarketplace(nftMarketplace.address)
      ).to.be.revertedWith("MarketplaceAddressExist");
    });

    it("Should add marketplace address by the owner", async () => {
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);
      expect(await nftMinting.nftMarketplace()).to.equal(
        nftMarketplace.address
      );
    });
  });

  describe("Accept Nomination", () => {
    it("Should revert if the caller is not nominee", async () => {
      await nftMinting.connect(admin).addNominee(add1.address);
      await expect(
        nftMinting.connect(add2).acceptNomination()
      ).to.be.revertedWith("NotNominee");
    });

    it("Should change the owner upon accepting nomination by the nominee", async () => {
      await nftMinting.connect(admin).addNominee(add1.address);

      const receipt = await nftMinting.connect(add1).acceptNomination();
      expectEvent.inTransaction(receipt.tx, nftMinting, "OwnerChanged", {
        owner: add1.address,
      });
      expect(await nftMinting.owner()).to.equal(add1.address);
    });
  });

  describe("Mint Nft", () => {
    it("Should revert if the caller is not owner", async () => {
      await expect(nftMinting.connect(add2).mintNft(1, uri)).to.be.revertedWith(
        "NotOwner"
      );
    });

    it("Should revert if the marketplace address is not set by the owner", async () => {
      await expect(
        nftMinting.connect(admin).mintNft(1, uri)
      ).to.be.revertedWith("ZeroAddress");
    });

    it("Should revert if the amount is zero", async () => {
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      await expect(
        nftMinting.connect(admin).mintNft(0, uri)
      ).to.be.revertedWith("ZeroAmount");
    });

    it("Should revert if the uri is invalid", async () => {
      let uri1 = "";

      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      await expect(
        nftMinting.connect(admin).mintNft(10, uri1)
      ).to.be.revertedWith("InvalidUri");
    });

    it("Should create tokenId and mint nft properly", async () => {
      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      // mint nft passing uri
      const receipt = await nftMinting.connect(admin).mintNft(10, uri);
      expectEvent.inTransaction(receipt.tx, nftMinting, "TokenMinted", {
        owner: admin.address,
        tokenId: 1,
        amount: 10,
      });

      // check tokenId
      expect(await nftMinting.tokenId(uri)).to.equal(1);
      // check uri
      expect(await nftMinting.uri(1)).to.equal(uri);
      // check total supply
      expect(await nftMinting.totalSupply(1)).to.equal(10);
      // check balance
      expect(await nftMinting.balanceOf(admin.address, 1)).to.equal(10);
      // check approval for marketplace
      expect(
        await nftMinting.isApprovedForAll(admin.address, nftMarketplace.address)
      ).to.equal(true);
    });
  });

  describe("Burn Nft", () => {
    it("Should revert if the caller is not marketplace", async () => {
      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      await expect(nftMinting.connect(admin).burnNft(1, 2)).to.be.revertedWith(
        "NotMarketplaceContract"
      );
    });

    it("Should revert if the amount is zero", async () => {
      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      // impersonate marketplace as signer
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [nftMarketplace.address],
      });
      const signer = await ethers.getSigner(nftMarketplace.address);

      // trasnfer some ethers to the signer
      await admin.sendTransaction({
        to: signer.address,
        value: ethers.utils.parseEther("1.0"),
        gasLimit: 5000000,
      });

      await expect(nftMinting.connect(signer).burnNft(1, 0)).to.be.revertedWith(
        "ZeroAmount"
      );

      // stop impersonate
      await network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [nftMarketplace.address],
      });
    });

    it("Should revert if there is not enough balance to burn", async () => {
      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      // impersonate marketplace as signer
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [nftMarketplace.address],
      });
      const signer = await ethers.getSigner(nftMarketplace.address);

      // trasnfer some ethers to the signer
      await admin.sendTransaction({
        to: signer.address,
        value: ethers.utils.parseEther("1.0"),
        gasLimit: 5000000,
      });

      await expect(
        nftMinting.connect(signer).burnNft(1, 10)
      ).to.be.revertedWith("NotEnoughBalanceToBurn");

      // stop impersonate
      await network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [nftMarketplace.address],
      });
    });

    it("Should burn the Nfts by the marketplace contract properly", async () => {
      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      // impersonate marketplace as signer
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [nftMarketplace.address],
      });
      const signer = await ethers.getSigner(nftMarketplace.address);

      // mint some nfts
      await nftMinting.connect(admin).mintNft(10, uri);

      // transfer some nfts to the marketplace contract
      await nftMinting
        .connect(admin)
        .safeTransferFrom(admin.address, signer.address, 1, 10, "0x00");

      // trasnfer some ethers to the signer
      await admin.sendTransaction({
        to: signer.address,
        value: ethers.utils.parseEther("1.0"),
        gasLimit: 5000000,
      });

      const receipt = await nftMinting.connect(signer).burnNft(1, 6);
      expectEvent.inTransaction(receipt.tx, nftMinting, "TokenBurnt", {
        owner: signer.address,
        tokenId: 1,
        amount: 6,
      });
      expect(await nftMinting.totalSupply(1)).to.equal(4);
      expect(await nftMinting.totalBurnt(1)).to.equal(6);
      expect(await nftMinting.balanceOf(signer.address, 1)).to.equal(4);

      // stop impersonate
      await network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [nftMarketplace.address],
      });
    });
  });
});
