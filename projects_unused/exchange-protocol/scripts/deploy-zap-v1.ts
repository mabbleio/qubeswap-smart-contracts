import { ethers, network, run } from "hardhat";
import config from "../config";

const main = async () => {
  // Compile contracts
  await run("compile");
  console.log("Compiled contracts.");

  const networkName = network.name;

  // Sanity checks
  if (networkName === "mainnet") {
    if (!process.env.KEY_MAINNET) {
      throw new Error("Missing private key, refer to README 'Deployment' section");
    }
  } else if (networkName === "testnet") {
    if (!process.env.KEY_TESTNET) {
      throw new Error("Missing private key, refer to README 'Deployment' section");
    }
  }

  if (!config.QubeRouter[networkName] || config.QubeRouter[networkName] === ethers.constants.AddressZero) {
    throw new Error("Missing router address, refer to README 'Deployment' section");
  }

  if (!config.WBNB[networkName] || config.WBNB[networkName] === ethers.constants.AddressZero) {
    throw new Error("Missing WBNB address, refer to README 'Deployment' section");
  }

  console.log("Deploying to network:", networkName);

  // Deploy QubeZapV1
  console.log("Deploying QubeZap V1..");

  const QubeZapV1 = await ethers.getContractFactory("QubeZapV1");

  const qubeZap = await QubeZapV1.deploy(
    config.WBNB[networkName],
    config.QubeRouter[networkName],
    config.MaxZapReverseRatio[networkName]
  );

  await qubeZap.deployed();

  console.log("QubeZap V1 deployed to:", qubeZap.address);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
