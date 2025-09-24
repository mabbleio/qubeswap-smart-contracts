import { artifacts, contract, ethers, network } from "hardhat";
import { time, BN, expectEvent, expectRevert } from "@openzeppelin/test-helpers";
import { parseEther, formatEther } from "ethers/lib/utils";
import { expect } from "chai";
import { beforeEach } from "mocha";
import { BigNumber } from "ethers";

import ERC20MockArtifact from "./artifactsFile/ERC20Mock.json";
import QubeSwapTokenArtifact from "./artifactsFile/QubeSwapToken.json";
import SyrupBarArtifact from "./artifactsFile/SyrupBar.json";
import MasterChefArtifact from "./artifactsFile/MasterChef.json";
import MasterChefV2Artifact from "./artifactsFile/MasterChefV2.json";
import QstPoolArtifact from "./artifactsFile/QstPool.json";
import VEQstArtifact from "./artifactsFile/VEQstTest.json";
import ProxyForQstPoolArtifact from "./artifactsFile/ProxyForQstPool.json";
import ProxyForQstPoolFactoryArtifact from "./artifactsFile/ProxyForQstPoolFactory.json";
import DelegatorArtifact from "./artifactsFile/Delegator.json";

const ZERO = BigNumber.from(0);
const DAY = BigNumber.from(86400);
const WEEK = DAY.mul(7);
const YEAR = DAY.mul(365);
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("VQst", () => {
  let ProxyForQstPoolFactorySC, masterChefV2, QstPoolSC, VEQstSC, QubeSwapTokenSC;
  let admin;
  let user1;
  let user2;
  let user3;
  let user4;
  let user5;

  before(async function () {
    [admin, user1, user2, user3, user4, user5] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const ERC20Mock = await ethers.getContractFactoryFromArtifact(ERC20MockArtifact);

    // deploy qst token
    const QubeSwapToken = await ethers.getContractFactoryFromArtifact(QubeSwapTokenArtifact);
    QubeSwapTokenSC = await QubeSwapToken.deploy();
    // mint qst for users
    await QubeSwapTokenSC["mint(address,uint256)"](admin.address, ethers.utils.parseUnits("100000000000000"));
    await QubeSwapTokenSC["mint(address,uint256)"](user1.address, ethers.utils.parseUnits("100000000000000"));
    await QubeSwapTokenSC["mint(address,uint256)"](user2.address, ethers.utils.parseUnits("100000000000000"));
    await QubeSwapTokenSC["mint(address,uint256)"](user3.address, ethers.utils.parseUnits("100000000000000"));
    await QubeSwapTokenSC["mint(address,uint256)"](user4.address, ethers.utils.parseUnits("100000000000000"));
    await QubeSwapTokenSC["mint(address,uint256)"](user5.address, ethers.utils.parseUnits("100000000000000"));

    // deploy SyrupBar
    const SyrupBar = await ethers.getContractFactoryFromArtifact(SyrupBarArtifact);
    const syrupBar = await SyrupBar.deploy(QubeSwapTokenSC.address);

    // deploy MasterChef
    const MasterChef = await ethers.getContractFactoryFromArtifact(MasterChefArtifact);
    const masterChef = await MasterChef.deploy(
      QubeSwapTokenSC.address,
      syrupBar.address,
      admin.address,
      ethers.utils.parseUnits("40"),
      ethers.constants.Zero
    );

    // transfer ownership to MasterChef
    await QubeSwapTokenSC.transferOwnership(masterChef.address);
    await syrupBar.transferOwnership(masterChef.address);

    const lpTokenV1 = await ERC20Mock.deploy("LP Token V1", "LPV1");
    const dummyTokenV2 = await ERC20Mock.deploy("Dummy Token V2", "DTV2");

    // add pools in MasterChef
    await masterChef.add(0, lpTokenV1.address, true); // farm with pid 1 and 0 allocPoint
    await masterChef.add(1, dummyTokenV2.address, true); // farm with pid 2 and 1 allocPoint

    // deploy MasterChefV2
    const MasterChefV2 = await ethers.getContractFactoryFromArtifact(MasterChefV2Artifact);
    masterChefV2 = await MasterChefV2.deploy(masterChef.address, QubeSwapTokenSC.address, 2, admin.address);

    await dummyTokenV2.mint(admin.address, ethers.utils.parseUnits("1000"));
    await dummyTokenV2.approve(masterChefV2.address, ethers.constants.MaxUint256);
    await masterChefV2.init(dummyTokenV2.address);

    const lpTokenV2 = await ERC20Mock.deploy("LP Token V2", "LPV2");
    const dummyTokenV3 = await ERC20Mock.deploy("Dummy Token V3", "DTV3");
    const dummyTokenForQstPool = await ERC20Mock.deploy("Dummy Token Qst Pool", "DTCP");
    const dummyTokenForSpecialPool2 = await ERC20Mock.deploy("Dummy Token Special pool 2", "DT");

    await masterChefV2.add(0, lpTokenV2.address, true, true); // regular farm with pid 0 and 1 allocPoint
    await masterChefV2.add(1, dummyTokenV3.address, true, true); // regular farm with pid 1 and 1 allocPoint
    await masterChefV2.add(1, dummyTokenForQstPool.address, false, true); // special farm with pid 2 and 1 allocPoint
    await masterChefV2.add(0, dummyTokenForSpecialPool2.address, false, true); // special farm with pid 3 and 0 allocPoint

    // deploy qst pool
    const QstPool = await ethers.getContractFactoryFromArtifact(QstPoolArtifact);
    QstPoolSC = await QstPool.deploy(
      QubeSwapTokenSC.address,
      masterChefV2.address,
      admin.address,
      admin.address,
      admin.address,
      2
    );
    await masterChefV2.updateWhiteList(QstPoolSC.address, true);
    await dummyTokenForQstPool.mint(admin.address, ethers.utils.parseUnits("1000"));
    await dummyTokenForQstPool.approve(QstPoolSC.address, ethers.constants.MaxUint256);
    await QstPoolSC.init(dummyTokenForQstPool.address);

    //  approve qst for QstPoolSC
    await QubeSwapTokenSC.connect(admin).approve(QstPoolSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user1).approve(QstPoolSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user2).approve(QstPoolSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user3).approve(QstPoolSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user4).approve(QstPoolSC.address, ethers.constants.MaxUint256);

    // deploy ProxyForQstPoolFactory
    const ProxyForQstPoolFactory = await ethers.getContractFactoryFromArtifact(ProxyForQstPoolFactoryArtifact);
    ProxyForQstPoolFactorySC = await ProxyForQstPoolFactory.deploy();

    // deploy VEQst
    const VEQst = await ethers.getContractFactoryFromArtifact(VEQstArtifact);
    VEQstSC = await VEQst.deploy(QstPoolSC.address, QubeSwapTokenSC.address, ProxyForQstPoolFactorySC.address);

    await QubeSwapTokenSC.connect(admin).approve(VEQstSC.address, ethers.constants.MaxUint256);

    await ProxyForQstPoolFactorySC.initialize(VEQstSC.address);

    await QstPoolSC.setVQstContract(VEQstSC.address);

    await VEQstSC.initializeQstPoolMigration();

    //  approve qst for VEQst
    await QubeSwapTokenSC.connect(admin).approve(VEQstSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user1).approve(VEQstSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user2).approve(VEQstSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user3).approve(VEQstSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user4).approve(VEQstSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user5).approve(VEQstSC.address, ethers.constants.MaxUint256);

    await network.provider.send("evm_setAutomine", [false]);
  });

  afterEach(async () => {
    // await network.provider.send("hardhat_reset");
    await network.provider.send("evm_setAutomine", [true]);
  });

  describe("Check totalSupply", () => {
    beforeEach(async function () {
      // stop emission in qst pool
      await masterChefV2.set(2, 0, true);
      await masterChefV2.set(3, 1, true);
      // update qst pool
      await QstPoolSC.connect(user1).deposit(ethers.utils.parseUnits("1"), 0);
    });

    it("Total supply", async function () {
      let now = Number((await time.latest()).toString());

      let currectTimestamp = 1704326399;
      if (now >= currectTimestamp) {
        console.log("Test cases expired !!!");
      } else {
        await time.increaseTo(currectTimestamp);

        let user1UnlockTime = 1706745600; //
        await VEQstSC.connect(user1).createLock(ethers.utils.parseUnits("1000"), user1UnlockTime);

        let user2UnlockTime = 1761782400;
        await VEQstSC.connect(user2).createLock(ethers.utils.parseUnits("1000"), user2UnlockTime);

        let user3UnlockTime = 1706745600;
        await VEQstSC.connect(user3).createLock(ethers.utils.parseUnits("5000"), user3UnlockTime);

        await time.increase(1);

        let user4UnlockTime = 1730332800;
        await VEQstSC.connect(user4).createLock(ethers.utils.parseUnits("100000"), user4UnlockTime);

        let user5UnlockTime = 1730332800;
        await VEQstSC.connect(user5).createLock(ethers.utils.parseUnits("2500"), user5UnlockTime);

        await time.increase(1);

        let user1PointEpoch = await VEQstSC.userPointEpoch(user1.address);
        let user1PointHistory = await VEQstSC.userPointHistory(user1.address, user1PointEpoch);
        let balanceOfUser1 = await VEQstSC.balanceOf(user1.address);
        console.log("User1 bias:", balanceOfUser1, "slope: ", user1PointHistory.slope);

        let user2PointEpoch = await VEQstSC.userPointEpoch(user2.address);
        let user2PointHistory = await VEQstSC.userPointHistory(user2.address, user2PointEpoch);
        let balanceOfUser2 = await VEQstSC.balanceOf(user2.address);
        console.log("User2 bias:", balanceOfUser2, "slope: ", user2PointHistory.slope);

        let user3PointEpoch = await VEQstSC.userPointEpoch(user3.address);
        let user3PointHistory = await VEQstSC.userPointHistory(user3.address, user3PointEpoch);
        let balanceOfUser3 = await VEQstSC.balanceOf(user3.address);
        console.log("User3 bias:", balanceOfUser3, "slope: ", user3PointHistory.slope);

        let user4PointEpoch = await VEQstSC.userPointEpoch(user4.address);
        let user4PointHistory = await VEQstSC.userPointHistory(user4.address, user4PointEpoch);
        let balanceOfUser4 = await VEQstSC.balanceOf(user4.address);
        console.log("User4 bias:", balanceOfUser4, "slope: ", user4PointHistory.slope);

        let user5PointEpoch = await VEQstSC.userPointEpoch(user5.address);
        let user5PointHistory = await VEQstSC.userPointHistory(user5.address, user5PointEpoch);
        let balanceOfUser5 = await VEQstSC.balanceOf(user5.address);
        console.log("User5 bias:", balanceOfUser5, "slope: ", user5PointHistory.slope);

        let totalSupply = await VEQstSC.totalSupply();
        console.log("totalSupply:", totalSupply);

        let sum = balanceOfUser1.add(balanceOfUser2).add(balanceOfUser3).add(balanceOfUser4).add(balanceOfUser5);
        console.log("Sum :", sum);
        expect(totalSupply).to.deep.eq(sum);
      }
    });
  });
});
