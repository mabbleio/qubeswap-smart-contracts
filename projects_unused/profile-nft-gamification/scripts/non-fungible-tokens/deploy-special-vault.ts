import { ethers, network } from "hardhat";
import config from "../../config";

const currentNetwork = network.name;

const main = async () => {
  console.log("Deploying to network:", currentNetwork);

  const _thresholdTimeStamp = "";
  const _endBlock = "";
  const _numberPoints = "";
  const _campaignId = "";
  const _tokenURI = "";

  const BunnySpecialQstVault = await ethers.getContractFactory("BunnySpecialQstVault");

  const bunnySpecialQstVault = await BunnySpecialQstVault.deploy(
    config.QstVault[currentNetwork],
    config.BunnyMintingStation[currentNetwork],
    config.QubeProfile[currentNetwork],
    _endBlock,
    _thresholdTimeStamp,
    _numberPoints,
    _campaignId,
    _tokenURI
  );

  await bunnySpecialQstVault.deployed();
  console.log("BunnySpecialQstVault deployed to:", bunnySpecialQstVault.address);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
