require("@openzeppelin/hardhat-upgrades");

const { ethers, upgrades, network } = require("hardhat");
const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { constants } = require("@openzeppelin/test-helpers");
const expectEvent = require("@openzeppelin/test-helpers/src/expectEvent");

describe("DoubleFi Token", () => {
  let admin,
    add1,
    add2,
    DoubleFiToken,
    doubleFiToken,
    NFTMarketplace,
    nftMarketplace,
    Events,
    events;

  function getValue(value) {
    let amount = BigNumber.from(value).mul(
      BigNumber.from(10).pow(BigNumber.from(18))
    );

    return amount;
  }

  beforeEach(async () => {
    // initialize the signers
    [admin, add1, add2, _] = await ethers.getSigners();

    // deploy the contract using proxy
    DoubleFiToken = await ethers.getContractFactory("DoubleFi");
    doubleFiToken = await upgrades.deployProxy(DoubleFiToken, {
      initializer: "initialize",
    });
    await doubleFiToken.deployed();

    NFTMarketplace = await ethers.getContractFactory("Marketplace");
    nftMarketplace = await NFTMarketplace.deploy();

    // deploy events library
    Events = await ethers.getContractFactory("Events");
    events = await Events.deploy();
  });

  describe("Owner", () => {
    it("Should set the right owner", async () => {
      expect(await doubleFiToken.owner()).to.equal(admin.address);
    });
  });

  describe("Add Nft Marketplace Address", () => {
    it("Should revert if the txn is not by the owner", async () => {
      await expect(
        doubleFiToken.connect(add2).addMarketplace(nftMarketplace.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert if the marketplace address is zero address", async () => {
      await expect(
        doubleFiToken.connect(admin).addMarketplace(constants.ZERO_ADDRESS)
      ).to.be.revertedWith("ZeroAddress");
    });

    it("Should revert if the contract address already exist", async () => {
      await doubleFiToken.connect(admin).addMarketplace(nftMarketplace.address);

      await expect(
        doubleFiToken.connect(admin).addMarketplace(nftMarketplace.address)
      ).to.be.revertedWith("MarketplaceAddressExist");
    });

    it("Should add marketplace address by the owner", async () => {
      await doubleFiToken.connect(admin).addMarketplace(nftMarketplace.address);
      expect(await doubleFiToken.nftMarketplace()).to.equal(
        nftMarketplace.address
      );
    });
  });

  describe("Mint Tokens", () => {
    it("Should revert if the caller is not owner", async () => {
      let amount = getValue(100);
      await expect(
        doubleFiToken.connect(add2).mint(add1.address, amount)
      ).to.be.revertedWith("NotOwner");
    });

    it("Should revert if the amount is zero", async () => {
      let amount = getValue(100);

      // add marketplace address
      await doubleFiToken.connect(admin).addMarketplace(nftMarketplace.address);

      await expect(
        doubleFiToken.connect(admin).mint(add1.address, 0)
      ).to.be.revertedWith("ZeroAmount");
    });

    it("Should revert if the account is zero address", async () => {
      let amount = getValue(100);

      // add marketplace address
      await doubleFiToken.connect(admin).addMarketplace(nftMarketplace.address);

      await expect(
        doubleFiToken.connect(admin).mint(constants.ZERO_ADDRESS, amount)
      ).to.be.revertedWith("ZeroAddress");
    });

    it("Should mint the tokens by the owner properly", async () => {
      let amount = getValue(100);
      let total = getValue(100000000);

      // add marketplace address
      await doubleFiToken.connect(admin).addMarketplace(nftMarketplace.address);

      // mint double-fi tokens
      const receipt = await doubleFiToken
        .connect(admin)
        .mint(add1.address, amount);
      expectEvent.inTransaction(
        receipt.tx,
        doubleFiToken,
        "DoubleFiTokenMinted",
        {
          account: add1.address,
          amount: amount,
        }
      );

      total = BigNumber.from(total).add(BigNumber.from(amount));

      // check values
      expect(await doubleFiToken.balanceOf(add1.address)).to.equal(amount);
      expect(await doubleFiToken.totalSupply()).to.equal(total);
    });

    it("Should mint the tokens by the market place properly", async () => {
      let amount = getValue(100);
      let total = getValue(100000000);

      // add marketplace address
      await doubleFiToken.connect(admin).addMarketplace(nftMarketplace.address);

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

      // mint double-fi tokens
      const receipt = await doubleFiToken
        .connect(signer)
        .mint(add1.address, amount);
      expectEvent.inTransaction(
        receipt.tx,
        doubleFiToken,
        "DoubleFiTokenMinted",
        {
          account: add1.address,
          amount: amount,
        }
      );

      total = BigNumber.from(total).add(BigNumber.from(amount));

      // check values
      expect(await doubleFiToken.balanceOf(add1.address)).to.equal(amount);
      expect(await doubleFiToken.totalSupply()).to.equal(total);
    });
  });

  describe("Burn Tokens", () => {
    it("Should revert if the caller is not owner", async () => {
      let amount = getValue(100);
      await expect(doubleFiToken.connect(add2).burn(amount)).to.be.revertedWith(
        "NotOwner"
      );
    });

    it("Should revert if the amount is zero", async () => {
      let amount = getValue(100);

      // add marketplace address
      await doubleFiToken.connect(admin).addMarketplace(nftMarketplace.address);

      await expect(doubleFiToken.connect(admin).burn(0)).to.be.revertedWith(
        "ZeroAmount"
      );
    });

    it("Should revert if there is not enough balance with the owner to burn", async () => {
      let amount = getValue(1000000000);

      // add marketplace address
      await doubleFiToken.connect(admin).addMarketplace(nftMarketplace.address);

      await expect(
        doubleFiToken.connect(admin).burn(amount)
      ).to.be.revertedWith("NotEnoughBalanceToBurn");
    });

    it("Should burn the tokens by the owner properly", async () => {
      let amount = getValue(100);
      let total = getValue(100000000);

      // add marketplace address
      await doubleFiToken.connect(admin).addMarketplace(nftMarketplace.address);

      // burn double-fi tokens
      const receipt = await doubleFiToken.connect(admin).burn(amount);
      expectEvent.inTransaction(
        receipt.tx,
        doubleFiToken,
        "DoubleFiTokenBurnt",
        {
          amount: amount,
        }
      );

      total = BigNumber.from(total).sub(BigNumber.from(amount));

      // check values
      expect(await doubleFiToken.balanceOf(admin.address)).to.equal(total);
      expect(await doubleFiToken.totalSupply()).to.equal(total);
    });

    it("Should burn the tokens by the market place properly", async () => {
      let amount = getValue(100);
      let total = getValue(100000000);

      // add marketplace address
      await doubleFiToken.connect(admin).addMarketplace(nftMarketplace.address);

      // mint double-fi token to the marketplace
      await doubleFiToken.connect(admin).mint(nftMarketplace.address, amount);

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

      // burn double-fi tokens
      const receipt = await doubleFiToken.connect(signer).burn(amount);
      expectEvent.inTransaction(
        receipt.tx,
        doubleFiToken,
        "DoubleFiTokenBurnt",
        {
          account: add1.address,
          amount: amount,
        }
      );

      // check values
      expect(await doubleFiToken.balanceOf(nftMarketplace.address)).to.equal(0);
      expect(await doubleFiToken.totalSupply()).to.equal(total);
    });
  });
});
