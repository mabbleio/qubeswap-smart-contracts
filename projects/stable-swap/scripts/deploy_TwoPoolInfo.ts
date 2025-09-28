import { ethers, run, network } from "hardhat";

async function main() {
  // Get network data from Hardhat config (see hardhat.config.ts).
  const networkName = network.name;
  // Check if the network is supported.
  if (networkName === "testnet" || networkName === "mainnet") {
    console.log(`Deploying to ${networkName} network...`);

    // Compile contracts.
    await run("compile");
    console.log("Compiled contracts...");

    const QubeStableSwapTwoPoolInfo = await ethers.getContractFactory("QubeStableSwapTwoPoolInfo");
    const qubeStableSwapTwoPoolInfo = await QubeStableSwapTwoPoolInfo.deploy();
    await qubeStableSwapTwoPoolInfo.deployed();

    console.log("qubeStableSwapTwoPoolInfo deployed to:", qubeStableSwapTwoPoolInfo.address);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
