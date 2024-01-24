const { ethers, upgrades } = require("hardhat");

async function main() {
  [deployer] = await ethers.getSigners();

  // deploy NFT minting contract
  console.log(
    `Deploying NFT Minting Contract with the address ${deployer.address}`
  );
  const NFTMinting = await ethers.getContractFactory("NFTMinting");
  const nftMinting = await upgrades.deployProxy(NFTMinting, {
    initializer: "initialize",
  });
  nftMinting.deployed();
  console.log(
    `Minting contract deployed to the address: ${nftMinting.address}`
  );

  // deploy Token contract
  console.log(`Deploying Token Contract with the address ${deployer.address}`);
  const TokenContract = await ethers.getContractFactory("USDTToken");
  const tokenContract = await upgrades.deployProxy(TokenContract, {
    initializer: "initialize",
  });
  tokenContract.deployed();
  console.log(
    `Token contract deployed to the address: ${tokenContract.address}`
  );

  // deploy Martketplace contract
  console.log(
    `Deploying Marketplace Contract with the address ${deployer.address}`
  );
  const Marketplace = await ethers.getContractFactory("NFTMarketplace");
  const marketplace = await upgrades.deployProxy(
    Marketplace,
    [nftMinting.address, tokenContract.address],
    {
      initializer: "initialize",
    }
  );
  marketplace.deployed({gasLimit: 400000000});
  console.log(
    `Marketplace contract deployed to the address: ${marketplace.address}`
  );
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
