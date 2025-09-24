import { ethers, network } from "hardhat";
import { parseEther } from "ethers/lib/utils";
import config from "../../config";

const currentNetwork = network.name;

const main = async () => {
  console.log("Deploying to network:", currentNetwork);

  const _numberQstToRegister = parseEther("1"); // 1 QST
  const _numberQstToReactivate = parseEther("2"); // 2 QST
  const _numberQstToUpdate = parseEther("2"); // 2 QST

  const QubeProfile = await ethers.getContractFactory("QubeProfile");

  const qubeProfile = await QubeProfile.deploy(
    config.QubeSwapToken[currentNetwork],
    _numberQstToReactivate,
    _numberQstToRegister,
    _numberQstToUpdate
  );

  console.log("QubeProfile deployed to:", qubeProfile.address);

  await qubeProfile.addTeam("Syrup Storm", "ipfs://QmamkDch4WBYGbchd6NV7MzPvG1NgWqWHNnYogdzreNtBn/syrup-storm.json");
  await qubeProfile.addTeam(
    "Fearsome Flippers",
    "ipfs://QmamkDch4WBYGbchd6NV7MzPvG1NgWqWHNnYogdzreNtBn/fearsome-flippers.json"
  );
  await qubeProfile.addTeam(
    "Chaotic Qstrs",
    "ipfs://QmamkDch4WBYGbchd6NV7MzPvG1NgWqWHNnYogdzreNtBn/chaotic-qstrs.json"
  );
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
