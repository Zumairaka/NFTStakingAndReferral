require("@openzeppelin/hardhat-upgrades");

const { ethers, upgrades, network } = require("hardhat");
const { expect } = require("chai");
const { BigNumber, providers } = require("ethers");
const { constants } = require("@openzeppelin/test-helpers");
const expectEvent = require("@openzeppelin/test-helpers/src/expectEvent");

describe("NFTMarketplace", () => {
  let admin,
    add1,
    add2,
    NFTMinting,
    nftMinting,
    NFTMarketplace,
    nftMarketplace,
    Events,
    events,
    Usdt,
    usdt;
  let uri = "https://arweave.net/eR4wgSnWusIG-xF2BZzsiOwVehQsvfCT8VAUC4NHQ5Y";

  // function for converting amount in decimals(usdt is 6 decimals)
  function getValue(amount) {
    let value = BigNumber.from(amount).mul(
      BigNumber.from(10).pow(BigNumber.from(18))
    );

    return value;
  }

  // function for converting the time to seconds
  function getTimeToSec(time) {
    let sec = time * 24 * 60 * 60;

    return sec;
  }

  // function for computing reward1 at the time of purchase (for referrer1; 1.5%)
  function getReferrerReward1(amount) {
    let reward = BigNumber.from(amount)
      .mul(BigNumber.from(15))
      .div(BigNumber.from(1000));

    return reward;
  }

  // function for computing reward2 at the time of purchase (for referrer2; 1%)
  function getReferrerReward2(amount) {
    let reward = BigNumber.from(amount)
      .mul(BigNumber.from(10))
      .div(BigNumber.from(1000));

    return reward;
  }

  // function for computing reward3 at the time of purchase (for referrer3; 0.5%)
  function getReferrerReward3(amount) {
    let reward = BigNumber.from(amount)
      .mul(BigNumber.from(5))
      .div(BigNumber.from(1000));

    return reward;
  }

  // function for computing the total reward for the purchaser till the validity (5% for phase-1)
  function getTotalPurchaserReward(amount, validity) {
    let reward = BigNumber.from(amount)
      .mul(BigNumber.from(5))
      .div(BigNumber.from(100));

    let totalReward = BigNumber.from(reward)
      .div(BigNumber.from(getTimeToSec(30)))
      .mul(BigNumber.from(validity));

    return totalReward;
  }

  // function for computing the total reward for the referrer1 till the validity (1.5% for phase-1)
  function getTotalReferrerReward1(amount, validity) {
    let reward = getReferrerReward1(amount);

    let totalReward = BigNumber.from(reward)
      .div(BigNumber.from(getTimeToSec(30)))
      .mul(BigNumber.from(validity));

    return totalReward;
  }

  // function for computing the total reward for the referrer2 till the validity (1% for phase-1)
  function getTotalReferrerReward2(amount, validity) {
    let reward = getReferrerReward2(amount);

    let totalReward = BigNumber.from(reward)
      .div(BigNumber.from(getTimeToSec(30)))
      .mul(BigNumber.from(validity));

    return totalReward;
  }

  // function for computing the total reward for the referrer3 till the validity (0.5% for phase-1)
  function getTotalReferrerReward3(amount, validity) {
    let reward = getReferrerReward3(amount);

    let totalReward = BigNumber.from(reward)
      .div(BigNumber.from(getTimeToSec(30)))
      .mul(BigNumber.from(validity));

    return totalReward;
  }

  function getPenalty(amount) {
    let penalty = BigNumber.from(amount)
      .mul(BigNumber.from(40))
      .div(BigNumber.from(100));
    return penalty;
  }

  beforeEach(async () => {
    // initialize the signers
    [admin, add1, add2, add3, add4, _] = await ethers.getSigners();

    // deploy the minting contract using proxy
    NFTMinting = await ethers.getContractFactory("NFTMinting");
    nftMinting = await upgrades.deployProxy(NFTMinting, {
      initializer: "initialize",
    });
    await nftMinting.deployed();

    // deploy usdt contract
    Usdt = await ethers.getContractFactory("USDT");
    usdt = await upgrades.deployProxy(Usdt, {
      initializer: "initialize",
    });
    await usdt.deployed();

    // deploy marketplace contract
    NFTMarketplace = await ethers.getContractFactory("NFTMarketplace");
    nftMarketplace = await upgrades.deployProxy(
      NFTMarketplace,
      [nftMinting.address, usdt.address],
      {
        initializer: "initialize",
      }
    );

    // deploy events library
    Events = await ethers.getContractFactory("Events");
    events = await Events.deploy();
  });

  describe("Owner", () => {
    it("Should set the right owner", async () => {
      expect(await nftMarketplace.owner()).to.equal(admin.address);
    });
  });

  describe("Add Referrer", () => {
    it("Should revert if the referrer address is zero address", async () => {
      await expect(
        nftMarketplace.connect(add1).addReferrer(constants.ZERO_ADDRESS)
      ).to.be.revertedWith("ZeroAddress");
    });

    it("Should revert if the referrer address is already exist", async () => {
      // add referrer
      await nftMarketplace.connect(add1).addReferrer(add2.address);

      // re add referrer
      await expect(
        nftMarketplace.connect(add1).addReferrer(admin.address)
      ).to.be.revertedWith("ReferrerAlreadyExist");
    });

    it("Should add referrer properly", async () => {
      let receipt = await nftMarketplace
        .connect(add1)
        .addReferrer(add2.address);
      expectEvent.inTransaction(receipt.tx, nftMarketplace, "AddedReferrer", {
        sender: add1.address,
        referrer: add2.address,
      });

      expect(await nftMarketplace._referrer(add1.address)).to.equal(
        add2.address
      );
    });
  });

  describe("Create Financial Instrument", () => {
    it("Should revert if the txn is not done by the owner", async () => {
      let price = getValue(10);
      let validity = getTimeToSec(10);

      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      // mint some nfts using NFTMinting contract
      await nftMinting.connect(admin).mintNft(10, uri);

      // trasnfer some nfts to the add1 address
      await nftMinting
        .connect(admin)
        .safeTransferFrom(admin.address, add1.address, 1, 5, "0x00");

      // create marketItem
      await expect(
        nftMarketplace
          .connect(add1)
          .createFinancialInstrument(1, 5, price, 500, validity)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert if the no of items are zero", async () => {
      let price = getValue(10);
      let validity = getTimeToSec(10);

      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      // mint some nfts using NFTMinting contract
      await nftMinting.connect(admin).mintNft(10, uri);

      // create marketItem
      await expect(
        nftMarketplace
          .connect(admin)
          .createFinancialInstrument(1, 0, price, 500, validity)
      ).to.be.revertedWith("ZeroAmount");
    });

    it("Should revert if the price per item is zero", async () => {
      let price = getValue(10);
      let validity = getTimeToSec(10);

      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      // mint some nfts using NFTMinting contract
      await nftMinting.connect(admin).mintNft(10, uri);

      // create marketItem
      await expect(
        nftMarketplace
          .connect(admin)
          .createFinancialInstrument(1, 10, 0, 500, validity)
      ).to.be.revertedWith("ZeroAmount");
    });

    it("Should revert if the validity is zero", async () => {
      let price = getValue(10);
      let validity = getTimeToSec(10);

      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      // mint some nfts using NFTMinting contract
      await nftMinting.connect(admin).mintNft(10, uri);

      // create marketItem
      await expect(
        nftMarketplace
          .connect(admin)
          .createFinancialInstrument(1, 10, price, 500, 0)
      ).to.be.revertedWith("ZeroAmount");
    });

    it("Should revert if the rate is invalid (zero or more than 100%)", async () => {
      let price = getValue(10);
      let validity = getTimeToSec(10);

      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      // mint some nfts using NFTMinting contract
      await nftMinting.connect(admin).mintNft(10, uri);

      // create marketItem
      await expect(
        nftMarketplace
          .connect(admin)
          .createFinancialInstrument(1, 10, price, 50000, validity)
      ).to.be.revertedWith("InvalidRate");
    });

    it("Should revert if not enough balance with the owner", async () => {
      let price = getValue(10);
      let validity = getTimeToSec(10);

      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      // mint some nfts using NFTMinting contract
      await nftMinting.connect(admin).mintNft(10, uri);

      // create marketItem
      await expect(
        nftMarketplace
          .connect(admin)
          .createFinancialInstrument(1, 11, price, 500, validity)
      ).to.be.revertedWith("InSufficientNFTBalance");
    });

    it("Should create the financial instrument and update the details properly", async () => {
      let price = getValue(10);
      let validity = getTimeToSec(10);

      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      // mint some nfts using NFTMinting contract
      await nftMinting.connect(admin).mintNft(10, uri);

      // create marketItem
      let receipt = await nftMarketplace
        .connect(admin)
        .createFinancialInstrument(1, 10, price, 500, validity);

      expectEvent.inTransaction(
        receipt.tx,
        nftMarketplace,
        "FinancialInstrumentCreated",
        {
          itemId: 1,
          tokenId: 1,
          noOfItems: 10,
          pricePerItem: 10000000,
          rewardRate: 500,
          validity: 864000,
        }
      );

      let FinancialInstrument = await nftMarketplace._financialInstrument(1);

      expect(await nftMinting.balanceOf(nftMarketplace.address, 1)).to.equal(
        10
      );
      expect(await nftMinting.balanceOf(admin.address, 1)).to.equal(0);
      expect(FinancialInstrument.tokenId).to.equal(1);
      expect(FinancialInstrument.noOfItems).to.equal(10);
      expect(FinancialInstrument.pricePerItem).to.equal(price);
      expect(FinancialInstrument.rewardRate).to.equal(500);
      expect(FinancialInstrument.itemSold).to.equal(0);
      expect(FinancialInstrument.itemBurnt).to.equal(0);
      expect(FinancialInstrument.validity).to.equal(validity);
    });
  });

  describe("Withdraw Balance", () => {
    it("Should revert if the caller is not owner", async () => {
      await expect(
        nftMarketplace.connect(add1).withdrawBalance()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert if there is not enough token balance to withdraw", async () => {
      await expect(
        nftMarketplace.connect(admin).withdrawBalance()
      ).to.be.revertedWith("InsufficientTokenBalance");
    });

    it("Should transfer the contract token balance to the owner", async () => {
      let amount = getValue(1000);
      let remaining = getValue(9000);
      let total = getValue(10000);

      // transfer some tokens to the smart contract
      await usdt.connect(admin).transfer(nftMarketplace.address, amount);

      expect(await usdt.balanceOf(nftMarketplace.address)).to.equal(amount);
      expect(await usdt.balanceOf(admin.address)).to.equal(remaining);

      let receipt = await nftMarketplace.connect(admin).withdrawBalance();
      expectEvent.inTransaction(
        receipt.tx,
        nftMarketplace,
        "ContractBalanceWithdrawn",
        { owner: admin.address, balance: amount }
      );

      expect(await usdt.balanceOf(nftMarketplace.address)).to.equal(0);
      expect(await usdt.balanceOf(admin.address)).to.equal(total);
    });
  });

  describe("Withdraw Penalty", () => {
    it("Should revert if the caller is not owner", async () => {
      await expect(
        nftMarketplace.connect(add1).withdrawPenalty()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert if the penalty balance is zer0", async () => {
      await expect(
        nftMarketplace.connect(admin).withdrawPenalty()
      ).to.be.revertedWith("ZeroPenaltyBalance");
    });

    it("Should let the owner to withdraw the penalty", async () => {
      let price = getValue(10);
      let validity = getTimeToSec(30);
      let amount = getValue(100);
      let marketplaceTransfer = getValue(9900);
      let unlockTime = getTimeToSec(15);

      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      // mint some nfts using NFTMinting contract
      await nftMinting.connect(admin).mintNft(10, uri);

      // create marketItem
      await nftMarketplace
        .connect(admin)
        .createFinancialInstrument(1, 10, price, 500, validity);

      // transfer some usdt to the user and marketplace
      await usdt.connect(admin).transfer(add1.address, amount);
      await usdt
        .connect(admin)
        .transfer(nftMarketplace.address, marketplaceTransfer);

      // approve token transfer
      await usdt.connect(add1).approve(nftMarketplace.address, amount);

      // buy items
      await nftMarketplace.connect(add1).buyFinancialInstrument(1, 10);

      // go to the next block and mine it
      await network.provider.send("evm_increaseTime", [unlockTime]);
      await network.provider.send("evm_mine");

      // compute penalty
      let penalty = getPenalty(amount);

      // approve
      await nftMinting
        .connect(add1)
        .setApprovalForAll(nftMarketplace.address, true);

      // withdraw capital
      await nftMarketplace.connect(add1).withdrawCapital(1);

      // withdraw penalty
      let receipt = await nftMarketplace.connect(admin).withdrawPenalty();
      expectEvent.inTransaction(
        receipt.tx,
        nftMarketplace,
        "PenaltyWithdrawn",
        {
          owner: admin.address,
          penalty: penalty,
        }
      );

      // check admin balance
      let balance = BigNumber.from(penalty).add(BigNumber.from(amount));
      expect(await usdt.balanceOf(admin.address)).to.equal(balance);
      expect(await nftMarketplace.collectedPenalty()).to.equal(0);
    });
  });

  describe("Buy Financial Instrument", () => {
    it("Should revert if the number of items available to buy is less than the requested", async () => {
      let price = getValue(10);
      let validity = getTimeToSec(10);
      let amount = getValue(100);

      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      // mint some nfts using NFTMinting contract
      await nftMinting.connect(admin).mintNft(10, uri);

      // create marketItem
      await nftMarketplace
        .connect(admin)
        .createFinancialInstrument(1, 10, price, 500, validity);

      // transfer some usdt to the users
      await usdt.connect(admin).transfer(add1.address, amount);

      await expect(
        nftMarketplace.connect(add1).buyFinancialInstrument(1, 11)
      ).to.be.revertedWith("InsufficientFinancialInstrumentBalance");
    });

    it("Should revert if there is not enough balance to buy the items", async () => {
      let price = getValue(10);
      let validity = getTimeToSec(10);
      let amount = getValue(100);

      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      // mint some nfts using NFTMinting contract
      await nftMinting.connect(admin).mintNft(10, uri);

      // create marketItem
      await nftMarketplace
        .connect(admin)
        .createFinancialInstrument(1, 10, price, 500, validity);

      await expect(
        nftMarketplace.connect(add1).buyFinancialInstrument(1, 10)
      ).to.be.revertedWith("InsufficientTokenBalance");
    });

    it("Should buy financial instrument and update the details properly", async () => {
      let price = getValue(10);
      let validity = getTimeToSec(10);
      let amount = getValue(100);
      let total = getValue(10000);

      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      // mint some nfts using NFTMinting contract
      await nftMinting.connect(admin).mintNft(10, uri);

      // create marketItem
      await nftMarketplace
        .connect(admin)
        .createFinancialInstrument(1, 10, price, 500, validity);

      // transfer some usdt to the user
      await usdt.connect(admin).transfer(add1.address, amount);

      // approve token transfer
      await usdt.connect(add1).approve(nftMarketplace.address, amount);

      // buy items
      let receipt = await nftMarketplace
        .connect(add1)
        .buyFinancialInstrument(1, 10);

      // fetch current blocktime
      let timestamp = (await ethers.provider.getBlock()).timestamp;
      let unlockTime = BigNumber.from(timestamp).add(BigNumber.from(validity));

      // check event
      expectEvent.inTransaction(
        receipt.tx,
        nftMarketplace,
        "FinancialInstrumentSold",
        {
          itemId: 1,
          tokenId: 1,
          noOfItems: 10,
          purchaseAmount: amount,
          rewardRate: 500,
          validity: validity,
          buyer: add1.address,
        }
      );

      // check financial instrument details
      let FinancialInstrument = await nftMarketplace._financialInstrument(1);
      expect(FinancialInstrument.tokenId).to.equal(1);
      expect(FinancialInstrument.noOfItems).to.equal(10);
      expect(FinancialInstrument.pricePerItem).to.equal(price);
      expect(FinancialInstrument.rewardRate).to.equal(500);
      expect(FinancialInstrument.itemSold).to.equal(10);
      expect(FinancialInstrument.itemBurnt).to.equal(0);
      expect(FinancialInstrument.validity).to.equal(validity);

      // check purchase details
      let PurchaseData = await nftMarketplace._purchaseData(1);
      expect(PurchaseData.itemId).to.equal(1);
      expect(PurchaseData.noOfItems).to.equal(10);
      expect(PurchaseData.purchaseAmount).to.equal(amount);
      expect(PurchaseData.unlockTime).to.equal(unlockTime);
      expect(PurchaseData.buyer).to.equal(add1.address);

      // check balances
      expect(await nftMinting.balanceOf(add1.address, 1)).to.equal(10);
      expect(await nftMinting.balanceOf(nftMarketplace.address, 1)).to.equal(0);
      expect(await usdt.balanceOf(admin.address)).to.equal(total);
      expect(await usdt.balanceOf(add1.address)).to.equal(0);
      expect(await nftMarketplace.totalPurchasedAmount()).to.equal(amount);
    });

    it("Should revert if there is not enough balance for giving referrer bonuses", async () => {
      let price = getValue(10);
      let validity = getTimeToSec(10);
      let amount = getValue(100);
      let total = getValue(10000);

      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      // mint some nfts using NFTMinting contract
      await nftMinting.connect(admin).mintNft(10, uri);

      // create marketItem
      await nftMarketplace
        .connect(admin)
        .createFinancialInstrument(1, 10, price, 500, validity);

      // transfer some usdt to the user
      await usdt.connect(admin).transfer(add1.address, amount);

      // add referrers (3 level referrers for add1)
      await nftMarketplace.connect(add3).addReferrer(add4.address);
      await nftMarketplace.connect(add2).addReferrer(add3.address);
      await nftMarketplace.connect(add1).addReferrer(add2.address);

      // approve token transfer
      await usdt.connect(add1).approve(nftMarketplace.address, amount);

      // buy items
      await expect(
        nftMarketplace.connect(add1).buyFinancialInstrument(1, 10)
      ).to.be.revertedWith("InsufficientBalanceInRewardPool");
    });

    it("Should buy financial instrument and send referrer bonuses properly", async () => {
      let price = getValue(10);
      let validity = getTimeToSec(10);
      let amount = getValue(100);

      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      // mint some nfts using NFTMinting contract
      await nftMinting.connect(admin).mintNft(10, uri);

      // create marketItem
      await nftMarketplace
        .connect(admin)
        .createFinancialInstrument(1, 10, price, 500, validity);

      // transfer some usdt to the user and marketplace
      await usdt.connect(admin).transfer(add1.address, amount);
      await usdt.connect(admin).transfer(nftMarketplace.address, amount);

      // add referrers (3 level referrers for add1)
      await nftMarketplace.connect(add3).addReferrer(add4.address);
      await nftMarketplace.connect(add2).addReferrer(add3.address);
      await nftMarketplace.connect(add1).addReferrer(add2.address);

      // approve token transfer
      await usdt.connect(add1).approve(nftMarketplace.address, amount);

      // buy items
      let receipt = await nftMarketplace
        .connect(add1)
        .buyFinancialInstrument(1, 10);

      // compute reward for referrer1
      let reward1 = getReferrerReward1(amount);

      // compute reward for referrer1
      let reward2 = getReferrerReward2(amount);

      // compute reward for referrer1
      let reward3 = getReferrerReward3(amount);

      let totalReward = BigNumber.from(reward1)
        .add(BigNumber.from(reward2))
        .add(BigNumber.from(reward3));
      let balanceInMarketplace = BigNumber.from(amount).sub(
        BigNumber.from(totalReward)
      );

      // check event for the reward1
      expectEvent.inTransaction(receipt.tx, nftMarketplace, "RewardReleased", {
        purchaseId: 1,
        beneficiary: add2.address,
        amount: reward1,
      });

      // check event for the reward2
      expectEvent.inTransaction(receipt.tx, nftMarketplace, "RewardReleased", {
        purchaseId: 1,
        beneficiary: add3.address,
        amount: reward2,
      });

      // check event for the reward3
      expectEvent.inTransaction(receipt.tx, nftMarketplace, "RewardReleased", {
        purchaseId: 1,
        beneficiary: add4.address,
        amount: reward3,
      });

      // check balances
      expect(await usdt.balanceOf(add2.address)).to.equal(reward1);
      expect(await usdt.balanceOf(add3.address)).to.equal(reward2);
      expect(await usdt.balanceOf(add4.address)).to.equal(reward3);
      expect(await usdt.balanceOf(nftMarketplace.address)).to.equal(
        balanceInMarketplace
      );
    });
  });

  describe("Withdraw Capital", () => {
    it("Should revert if the purchaser and claimer for capital are different", async () => {
      let price = getValue(10);
      let validity = getTimeToSec(10);
      let amount = getValue(100);

      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      // mint some nfts using NFTMinting contract
      await nftMinting.connect(admin).mintNft(10, uri);

      // create marketItem
      await nftMarketplace
        .connect(admin)
        .createFinancialInstrument(1, 10, price, 500, validity);

      // transfer some usdt to the user and marketplace
      await usdt.connect(admin).transfer(add1.address, amount);
      await usdt.connect(admin).transfer(nftMarketplace.address, amount);

      // approve token transfer
      await usdt.connect(add1).approve(nftMarketplace.address, amount);

      // buy items
      await nftMarketplace.connect(add1).buyFinancialInstrument(1, 10);

      // withdraw capital
      await expect(
        nftMarketplace.connect(add2).withdrawCapital(1)
      ).to.be.revertedWith("UnauthorizedAccess");
    });

    it("Should revert if the purchaser does not have total number of nfts to return", async () => {
      let price = getValue(10);
      let validity = getTimeToSec(10);
      let amount = getValue(100);

      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      // mint some nfts using NFTMinting contract
      await nftMinting.connect(admin).mintNft(10, uri);

      // create marketItem
      await nftMarketplace
        .connect(admin)
        .createFinancialInstrument(1, 10, price, 500, validity);

      // transfer some usdt to the user and marketplace
      await usdt.connect(admin).transfer(add1.address, amount);
      await usdt.connect(admin).transfer(nftMarketplace.address, amount);

      // approve token transfer
      await usdt.connect(add1).approve(nftMarketplace.address, amount);

      // buy items
      await nftMarketplace.connect(add1).buyFinancialInstrument(1, 10);

      // transfer some nfts to add2
      await nftMinting
        .connect(add1)
        .safeTransferFrom(add1.address, add2.address, 1, 2, "0x00");

      // withdraw capital
      await expect(
        nftMarketplace.connect(add1).withdrawCapital(1)
      ).to.be.revertedWith("NotEnoughFinancialInstrumentToReturn");
    });

    it("Should revert if there is not enough balance to release the remaining rewards", async () => {
      let price = getValue(10);
      let validity = getTimeToSec(30);
      let amount = getValue(100);
      let marketplaceTransfer = getValue(3);

      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      // mint some nfts using NFTMinting contract
      await nftMinting.connect(admin).mintNft(10, uri);

      // create marketItem
      await nftMarketplace
        .connect(admin)
        .createFinancialInstrument(1, 10, price, 500, validity);

      // transfer some usdt to the user and marketplace
      await usdt.connect(admin).transfer(add1.address, amount);
      await usdt
        .connect(admin)
        .transfer(nftMarketplace.address, marketplaceTransfer);

      // add referrers (3 level referrers for add1)
      await nftMarketplace.connect(add3).addReferrer(add4.address);
      await nftMarketplace.connect(add2).addReferrer(add3.address);
      await nftMarketplace.connect(add1).addReferrer(add2.address);

      // approve token transfer
      await usdt.connect(add1).approve(nftMarketplace.address, amount);

      // buy items
      await nftMarketplace.connect(add1).buyFinancialInstrument(1, 10);

      // withdraw capital
      await expect(
        nftMarketplace.connect(add1).withdrawCapital(1)
      ).to.be.revertedWith("InsufficientBalanceInRewardPool");
    });

    it("Should revert if there is not enough balance to release the capital", async () => {
      let price = getValue(10);
      let validity = getTimeToSec(30);
      let amount = getValue(100);
      let marketplaceTransfer = getValue(11);

      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      // mint some nfts using NFTMinting contract
      await nftMinting.connect(admin).mintNft(10, uri);

      // create marketItem
      await nftMarketplace
        .connect(admin)
        .createFinancialInstrument(1, 10, price, 500, validity);

      // transfer some usdt to the user and marketplace
      await usdt.connect(admin).transfer(add1.address, amount);
      await usdt
        .connect(admin)
        .transfer(nftMarketplace.address, marketplaceTransfer);

      // add referrers (3 level referrers for add1)
      await nftMarketplace.connect(add3).addReferrer(add4.address);
      await nftMarketplace.connect(add2).addReferrer(add3.address);
      await nftMarketplace.connect(add1).addReferrer(add2.address);

      // approve token transfer
      await usdt.connect(add1).approve(nftMarketplace.address, amount);

      // buy items
      await nftMarketplace.connect(add1).buyFinancialInstrument(1, 10);

      // withdraw capital
      await expect(
        nftMarketplace.connect(add1).withdrawCapital(1)
      ).to.be.revertedWith("InsufficientBalanceForWithdrawingCapital");
    });

    it("Should let the user to withdraw the capital without penalty after unlock time", async () => {
      let price = getValue(10);
      let validity = getTimeToSec(30);
      let amount = getValue(100);
      let marketplaceTransfer = getValue(111);

      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      // mint some nfts using NFTMinting contract
      await nftMinting.connect(admin).mintNft(10, uri);

      // create marketItem
      await nftMarketplace
        .connect(admin)
        .createFinancialInstrument(1, 10, price, 500, validity);

      // transfer some usdt to the user and marketplace
      await usdt.connect(admin).transfer(add1.address, amount);
      await usdt
        .connect(admin)
        .transfer(nftMarketplace.address, marketplaceTransfer);

      // add referrers (3 level referrers for add1)
      await nftMarketplace.connect(add3).addReferrer(add4.address);
      await nftMarketplace.connect(add2).addReferrer(add3.address);
      await nftMarketplace.connect(add1).addReferrer(add2.address);

      // approve token transfer
      await usdt.connect(add1).approve(nftMarketplace.address, amount);

      // buy items
      await nftMarketplace.connect(add1).buyFinancialInstrument(1, 10);

      let rewardBeforeWithdraw1 = await usdt.balanceOf(add2.address);
      let rewardBeforeWithdraw2 = await usdt.balanceOf(add3.address);
      let rewardBeforeWithdraw3 = await usdt.balanceOf(add4.address);

      // go to the next block and mine it
      await network.provider.send("evm_increaseTime", [validity]);
      await network.provider.send("evm_mine");

      // compute rewards for purchaser and referrers
      let reward = getTotalPurchaserReward(amount, validity);
      let reward1 = getTotalReferrerReward1(amount, validity);
      let reward2 = getTotalReferrerReward2(amount, validity);
      let reward3 = getTotalReferrerReward3(amount, validity);

      let total = BigNumber.from(reward).add(BigNumber.from(amount));
      let totalReward = BigNumber.from(reward)
        .add(BigNumber.from(reward1))
        .add(BigNumber.from(reward2))
        .add(BigNumber.from(reward3));

      add2Balance = BigNumber.from(reward1).add(
        BigNumber.from(rewardBeforeWithdraw1)
      );
      add3Balance = BigNumber.from(reward2).add(
        BigNumber.from(rewardBeforeWithdraw2)
      );
      add4Balance = BigNumber.from(reward3).add(
        BigNumber.from(rewardBeforeWithdraw3)
      );

      expect(await nftMarketplace.totalExpectedReward()).to.equal(totalReward);
      expect(await nftMarketplace.totalPurchasedAmount()).to.equal(amount);

      // approve
      await nftMinting
        .connect(add1)
        .setApprovalForAll(nftMarketplace.address, true);

      // withdraw capital
      let receipt = await nftMarketplace.connect(add1).withdrawCapital(1);
      expectEvent.inTransaction(
        receipt.tx,
        nftMarketplace,
        "CapitalWithdrawn",
        { purchaseId: 1, capitalAmount: amount, penalty: 0, reward: reward }
      );

      // check values
      expect(await usdt.balanceOf(add1.address)).to.equal(total);
      expect(await usdt.balanceOf(add2.address)).to.equal(add2Balance);
      expect(await usdt.balanceOf(add3.address)).to.equal(add3Balance);
      expect(await usdt.balanceOf(add4.address)).to.equal(add4Balance);
      expect(await nftMarketplace.totalExpectedReward()).to.equal(0);
      expect(await nftMarketplace.totalPurchasedAmount()).to.equal(0);
      expect(await nftMinting.balanceOf(nftMarketplace.address, 1)).to.equal(0);
    });

    it("Should let the user to withdraw the capital with penalty before unlock time", async () => {
      let price = getValue(10);
      let validity = getTimeToSec(30);
      let amount = getValue(100);
      let marketplaceTransfer = getValue(111);
      let unlockTime = getTimeToSec(15);

      // add marketplace address
      await nftMinting.connect(admin).addMarketplace(nftMarketplace.address);

      // mint some nfts using NFTMinting contract
      await nftMinting.connect(admin).mintNft(10, uri);

      // create marketItem
      await nftMarketplace
        .connect(admin)
        .createFinancialInstrument(1, 10, price, 500, validity);

      // transfer some usdt to the user and marketplace
      await usdt.connect(admin).transfer(add1.address, amount);
      await usdt
        .connect(admin)
        .transfer(nftMarketplace.address, marketplaceTransfer);

      // add referrers (3 level referrers for add1)
      await nftMarketplace.connect(add3).addReferrer(add4.address);
      await nftMarketplace.connect(add2).addReferrer(add3.address);
      await nftMarketplace.connect(add1).addReferrer(add2.address);

      // approve token transfer
      await usdt.connect(add1).approve(nftMarketplace.address, amount);

      // buy items
      await nftMarketplace.connect(add1).buyFinancialInstrument(1, 10);

      let rewardBeforeWithdraw1 = await usdt.balanceOf(add2.address);
      let rewardBeforeWithdraw2 = await usdt.balanceOf(add3.address);
      let rewardBeforeWithdraw3 = await usdt.balanceOf(add4.address);

      // go to the next block and mine it
      await network.provider.send("evm_increaseTime", [unlockTime - 2]);
      await network.provider.send("evm_mine");

      // compute rewards for purchaser and referrers
      let reward = getTotalPurchaserReward(amount, unlockTime);
      let reward1 = getTotalReferrerReward1(amount, unlockTime);
      let reward2 = getTotalReferrerReward2(amount, unlockTime);
      let reward3 = getTotalReferrerReward3(amount, unlockTime);
      let penalty = getPenalty(amount);

      let total = BigNumber.from(reward)
        .add(BigNumber.from(amount))
        .sub(BigNumber.from(penalty));

      add2Balance = BigNumber.from(reward1).add(
        BigNumber.from(rewardBeforeWithdraw1)
      );
      add3Balance = BigNumber.from(reward2).add(
        BigNumber.from(rewardBeforeWithdraw2)
      );
      add4Balance = BigNumber.from(reward3).add(
        BigNumber.from(rewardBeforeWithdraw3)
      );

      // approve
      await nftMinting
        .connect(add1)
        .setApprovalForAll(nftMarketplace.address, true);

      // withdraw capital
      let receipt = await nftMarketplace.connect(add1).withdrawCapital(1);
      expectEvent.inTransaction(
        receipt.tx,
        nftMarketplace,
        "CapitalWithdrawn",
        { purchaseId: 1, capitalAmount: amount, penalty: 0, reward: reward }
      );

      expectEvent.inTransaction(receipt.tx, nftMarketplace, "PenaltyDeducted", {
        itemId: 1,
        buyer: add1.address,
        penalty: penalty,
      });

      // check values
      expect(await usdt.balanceOf(add1.address)).to.equal(total);
      expect(await usdt.balanceOf(add2.address)).to.equal(add2Balance);
      expect(await usdt.balanceOf(add3.address)).to.equal(add3Balance);
      expect(await usdt.balanceOf(add4.address)).to.equal(add4Balance);
      expect(await nftMarketplace.totalExpectedReward()).to.equal(0);
      expect(await nftMarketplace.totalPurchasedAmount()).to.equal(0);
      expect(await nftMarketplace.collectedPenalty()).to.equal(penalty);
      expect(await nftMinting.balanceOf(nftMarketplace.address, 1)).to.equal(0);
    });
  });
});
