import { ethers, network, run } from "hardhat";
import config from "../config";

const main = async () => {
  // Get network data from Hardhat config (see hardhat.config.ts).
  const networkName = network.name;

  // Check if the network is supported.

  if (networkName === "testnet" || networkName === "mainnet") {
    console.log(`Deploying to ${networkName} network...`);

    // Check if the addresses in the config are set.
    if (config.QubeSwapToken[networkName] === ethers.constants.AddressZero) {
      throw new Error("Missing addresses for Qst token");
    }

    if (config.QubeProfile[networkName] === ethers.constants.AddressZero) {
      throw new Error("Missing addresses for Qube Profile");
    }

    if (config.Chainlink.LinkToken[networkName] === ethers.constants.AddressZero) {
      throw new Error("Missing addresses for Link token");
    }

    if (config.Operator[networkName] === ethers.constants.AddressZero) {
      throw new Error("Missing addresses for Link token");
    }

    // Compile contracts.
    await run("compile");
    console.log("Compiled contracts...");

    // Deploy contracts.
    const QubeSquad = await ethers.getContractFactory("QubeSquad");
    const qubeSquad = await QubeSquad.deploy(
      config.ERC721.Name[networkName],
      config.ERC721.Symbol[networkName],
      config.ERC721.Supply.Total[networkName]
    );

    // Wait for the contract to be deployed
    await qubeSquad.deployed();
    console.log(`QubeSquad to ${qubeSquad.address}`);

    const NFTSale = await ethers.getContractFactory("NFTSale");

    const nftSale = await NFTSale.deploy(
      qubeSquad.address,
      config.ERC721.Supply.Reserve[networkName],
      config.PricePerTicket[networkName],
      config.QubeSwapToken[networkName],
      config.QubeProfile[networkName],
      config.Operator[networkName],
      config.Chainlink.VRFCoordinator[networkName],
      config.Chainlink.LinkToken[networkName]
    );

    // Wait for the contract to be deployed
    await nftSale.deployed();
    console.log(`NFTSale to ${nftSale.address}`);

    // Transfer ownership of QubeSquad to NFTSale contract
    let tx = await qubeSquad.transferOwnership(nftSale.address);
    await tx.wait();
    console.log(`Ownership of QubeSquad transferred to ${nftSale.address}`);

    // Set fee and key hash for VRF
    tx = await nftSale.setFeeAndKeyHash(config.Chainlink.Fee[networkName], config.Chainlink.KeyHash[networkName]);

    await tx.wait();
    console.log(`Key hashes and fee set`);

    tx = await nftSale.drawRandomness();
    await tx.wait();
    console.log(`Test randomness has been called.`);
  } else {
    console.log(`Deploying to ${networkName} network is not supported...`);
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
