import { artifacts, contract, ethers, network } from "hardhat";
import { time, BN, expectEvent } from "@openzeppelin/test-helpers";
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
import VQstArtifact from "./artifactsFile/VQst.json";

const ZERO = BigNumber.from(0);

describe("VQst", () => {
  let QstPoolSC;
  let VQstSC;
  let QubeSwapTokenSC;
  let admin;
  let user1;
  let user2;
  let user3;
  before(async function () {
    [admin, user1, user2, user3] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const ERC20Mock = await ethers.getContractFactoryFromArtifact(ERC20MockArtifact);

    // Prepare for master chef v3

    const QubeSwapToken = await ethers.getContractFactoryFromArtifact(QubeSwapTokenArtifact);
    QubeSwapTokenSC = await QubeSwapToken.deploy();
    await QubeSwapTokenSC["mint(address,uint256)"](admin.address, ethers.utils.parseUnits("100000000"));
    await QubeSwapTokenSC["mint(address,uint256)"](user1.address, ethers.utils.parseUnits("100000000"));
    await QubeSwapTokenSC["mint(address,uint256)"](user2.address, ethers.utils.parseUnits("100000000"));
    await QubeSwapTokenSC["mint(address,uint256)"](user3.address, ethers.utils.parseUnits("100000000"));

    const SyrupBar = await ethers.getContractFactoryFromArtifact(SyrupBarArtifact);
    const syrupBar = await SyrupBar.deploy(QubeSwapTokenSC.address);

    const lpTokenV1 = await ERC20Mock.deploy("LP Token V1", "LPV1");
    const dummyTokenV2 = await ERC20Mock.deploy("Dummy Token V2", "DTV2");

    const MasterChef = await ethers.getContractFactoryFromArtifact(MasterChefArtifact);
    const masterChef = await MasterChef.deploy(
      QubeSwapTokenSC.address,
      syrupBar.address,
      admin.address,
      ethers.utils.parseUnits("40"),
      ethers.constants.Zero
    );

    await QubeSwapTokenSC.transferOwnership(masterChef.address);
    await syrupBar.transferOwnership(masterChef.address);

    await masterChef.add(0, lpTokenV1.address, true); // farm with pid 1 and 0 allocPoint
    await masterChef.add(1, dummyTokenV2.address, true); // farm with pid 2 and 1 allocPoint

    const MasterChefV2 = await ethers.getContractFactoryFromArtifact(MasterChefV2Artifact);
    const masterChefV2 = await MasterChefV2.deploy(masterChef.address, QubeSwapTokenSC.address, 2, admin.address);

    await dummyTokenV2.mint(admin.address, ethers.utils.parseUnits("1000"));
    await dummyTokenV2.approve(masterChefV2.address, ethers.constants.MaxUint256);
    await masterChefV2.init(dummyTokenV2.address);

    const lpTokenV2 = await ERC20Mock.deploy("LP Token V2", "LPV2");
    const dummyTokenV3 = await ERC20Mock.deploy("Dummy Token V3", "DTV3");
    const dummyTokenForQstPool = await ERC20Mock.deploy("Dummy Token Qst Pool", "DTCP");

    await masterChefV2.add(0, lpTokenV2.address, true, true); // regular farm with pid 0 and 1 allocPoint
    await masterChefV2.add(1, dummyTokenV3.address, true, true); // regular farm with pid 1 and 1 allocPoint
    await masterChefV2.add(1, dummyTokenForQstPool.address, false, true); // special farm with pid 2 and 1 allocPoint

    // set qst pool
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

    await QubeSwapTokenSC.connect(admin).approve(QstPoolSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user1).approve(QstPoolSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user2).approve(QstPoolSC.address, ethers.constants.MaxUint256);
    await QubeSwapTokenSC.connect(user3).approve(QstPoolSC.address, ethers.constants.MaxUint256);

    const VQstTest = await ethers.getContractFactoryFromArtifact(VQstArtifact);
    VQstSC = await VQstTest.deploy(QstPoolSC.address, masterChefV2.address, 2);

    await QstPoolSC.setVQstContract(VQstSC.address);
  });

  afterEach(async () => {
    await network.provider.send("hardhat_reset");
  });

  describe("Check VQst balance", () => {
    beforeEach(async function () {
      await VQstSC.connect(user1).syncFromQstPool();
      await VQstSC.connect(user2).syncFromQstPool();
      await VQstSC.connect(user3).syncFromQstPool();

      await QstPoolSC.connect(user1).deposit(ethers.utils.parseUnits("80000"), 3600 * 24 * 30);
      await QstPoolSC.connect(user2).deposit(ethers.utils.parseUnits("90000"), 3600 * 24 * 30);
      await QstPoolSC.connect(user3).deposit(ethers.utils.parseUnits("100000"), 3600 * 24 * 30);
    });

    it("The total balance of all users is equal to the totalSupply", async function () {
      const user1Balance = await VQstSC.balanceOf(user1.address);
      const user2Balance = await VQstSC.balanceOf(user2.address);
      const user3Balance = await VQstSC.balanceOf(user3.address);

      const totalSupply = await VQstSC.totalSupply();

      const usersBalance = user1Balance.add(user2Balance).add(user3Balance);

      expect(usersBalance).to.deep.eq(totalSupply);
    });

    it("The total balance of all users is equal to the totalSupply at specific block number", async function () {
      let user1Info = await QstPoolSC.userInfo(user1.address);
      console.log(user1Info.lockEndTime);

      let user1Balance = await VQstSC.balanceOf(user1.address);
      let user2Balance = await VQstSC.balanceOf(user2.address);
      let user3Balance = await VQstSC.balanceOf(user3.address);

      let totalSupply = await VQstSC.totalSupply();

      let usersBalance = user1Balance.add(user2Balance).add(user3Balance);
      expect(usersBalance).to.deep.eq(totalSupply);

      console.log(user1Balance, user2Balance, user3Balance, totalSupply);

      await time.increaseTo(user1Info.lockEndTime - 3600);

      user1Balance = await VQstSC.balanceOf(user1.address);
      user2Balance = await VQstSC.balanceOf(user2.address);
      user3Balance = await VQstSC.balanceOf(user3.address);

      totalSupply = await VQstSC.totalSupply();

      usersBalance = user1Balance.add(user2Balance).add(user3Balance);
      expect(usersBalance).to.deep.eq(totalSupply);

      console.log(user1Balance, user2Balance, user3Balance, totalSupply);

      await time.increaseTo(user1Info.lockEndTime + 3600);

      user1Balance = await VQstSC.balanceOf(user1.address);
      user2Balance = await VQstSC.balanceOf(user2.address);
      user3Balance = await VQstSC.balanceOf(user3.address);

      totalSupply = await VQstSC.totalSupply();

      usersBalance = user1Balance.add(user2Balance).add(user3Balance);
      expect(usersBalance).to.deep.eq(totalSupply);

      console.log(user1Balance, user2Balance, user3Balance, totalSupply);
    });

    it("Should return 0 when balanceOfAt(user, expiredBlock)", async function () {
      let user1Info = await QstPoolSC.userInfo(user1.address);

      await time.increaseTo(user1Info.lockEndTime - 100);
      let latestBN = (await time.latestBlock()).toString(10);
      let user1Balance = await VQstSC.balanceOfAt(user1.address, latestBN);

      expect(user1Balance).to.not.eq(0);

      await time.increaseTo(user1Info.lockEndTime + 100);

      latestBN = (await time.latestBlock()).toString(10);
      user1Balance = await VQstSC.balanceOfAt(user1.address, latestBN);
      expect(user1Balance).to.deep.eq(ZERO);
    });
  });
});
