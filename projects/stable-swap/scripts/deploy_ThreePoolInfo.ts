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

    const QubeStableSwapThreePoolInfo = await ethers.getContractFactory("QubeStableSwapThreePoolInfo");
    const qubeStableSwapThreePoolInfo = await QubeStableSwapThreePoolInfo.deploy();
    await qubeStableSwapThreePoolInfo.deployed();

    console.log("qubeStableSwapThreePoolInfo deployed to:", qubeStableSwapThreePoolInfo.address);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
