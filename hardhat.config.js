const { version } = require("chai");

/** @type import('hardhat/config').HardhatUserConfig */
require("hardhat-gas-reporter");
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.17",
      },
    ],
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
        details: {
          yul: false,
        },
      },
    },
  },
  gasReporter: {
    currency: "USDT",
    gasPrice: 21,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API,
  },
  networks: {
    multivacMainnet: {
      url: "https://rpc.mtv.ac",
      chainId: 62621,
      accounts: [`0x${process.env.PRIVATE_KEY}`],
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      chainId: 97,
      accounts: [`0x${process.env.PRIVATE_KEY}`],
    },
    avalancheFuji: {
      url: "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      accounts: [`0x${process.env.PRIVATE_KEY}`],
    },
    mumbai: {
      url: "https://matic-mumbai.chainstacklabs.com",
      chainId: 80001,
      accounts: [`0x${process.env.PRIVATE_KEY}`],
    },
    hardhat: {
      allowUnlimitedContractSize: true,
    },
  },
};
