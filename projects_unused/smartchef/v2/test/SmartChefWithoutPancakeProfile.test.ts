import { parseEther } from "ethers/lib/utils";
import { artifacts, contract } from "hardhat";
import { assert } from "chai";
import { BN, expectEvent, expectRevert, time, constants } from "@openzeppelin/test-helpers";
import { parse } from "dotenv";
import exp = require("constants");
import { describe } from "mocha";

const SmartChefFactory = artifacts.require("./SmartChefFactory");
const SmartChefInitializable = artifacts.require("./SmartChefInitializable");
const MockERC20 = artifacts.require("./test/MockERC20");
const MockERC721 = artifacts.require("./test/MockERC721");
const QubeProfile = artifacts.require("./test/MockQubeProfile");

contract("Smart Chef Pool Limit Per User", ([alice, bob, carol, david, erin, ...accounts]) => {
  let blockNumber;
  let startBlock;
  let endBlock;

  let poolLimitPerUser = parseEther("100");
  let numberBlocksForUserLimit = 25;
  let rewardPerBlock = parseEther("10");

  // Contracts
  let fakeQst, mockQST, mockPT, smartChef, smartChefFactory, mockQubeBunnies, qubeProfile;

  // Generic result variable
  let result: any;

  before(async () => {
    blockNumber = await time.latestBlock();
    startBlock = new BN(blockNumber).add(new BN(100));
    endBlock = new BN(blockNumber).add(new BN(500));

    mockQST = await MockERC20.new("Mock QST", "QST", parseEther("1000000"), {
      from: alice,
    });

    mockPT = await MockERC20.new("Mock Pool Token 1", "PT1", parseEther("4000"), {
      from: alice,
    });

    // Fake $Qst Token
    fakeQst = await MockERC20.new("FakeSwap", "Fake", parseEther("100"), { from: alice });

    smartChefFactory = await SmartChefFactory.new({ from: alice });

    // Qube Bunnies / Profile setup
    mockQubeBunnies = await MockERC721.new("Qube Bunnies", "PB", { from: alice });
    qubeProfile = await QubeProfile.new(mockQST.address, parseEther("2"), parseEther("1"), parseEther("2"), {
      from: alice,
    });

    await qubeProfile.addTeam("1st Team", "Be a Chef!", { from: alice });
    await qubeProfile.addNftAddress(mockQubeBunnies.address, { from: alice });
  });

  describe("SMART CHEF #3 - WITHOUT PANQST PROFILE", async () => {
    it("Deploy pool with SmartChefFactory", async () => {
      result = await smartChefFactory.deployPool(
        mockQST.address,
        mockPT.address,
        rewardPerBlock,
        startBlock,
        endBlock,
        poolLimitPerUser,
        numberBlocksForUserLimit,
        qubeProfile.address,
        false,
        0,
        alice
      );

      const poolAddress = result.receipt.logs[2].args[0];

      expectEvent(result, "NewSmartChefContract", { smartChef: poolAddress });

      smartChef = await SmartChefInitializable.at(poolAddress);

      await mockPT.transfer(smartChef.address, parseEther("1000"), { from: alice });
    });

    it("User deposit before pool limit is done", async () => {
      await mockQST.mintTokens(parseEther("1000"), { from: bob });
      await mockQST.approve(smartChef.address, parseEther("1000"), {
        from: bob,
      });
      await mockQubeBunnies.mint({ from: bob });
      await mockQubeBunnies.setApprovalForAll(qubeProfile.address, true, { from: bob });
      await mockQST.approve(qubeProfile.address, constants.MAX_UINT256, { from: bob });
      await qubeProfile.createProfile("1", mockQubeBunnies.address, "0", { from: bob });
      result = await smartChef.deposit(parseEther("100"), { from: bob });
      expectEvent(result, "Deposit", { user: bob, amount: String(parseEther("100")) });
      assert.equal(String(await smartChef.pendingReward(bob)), "0");
    });

    it("User deposit above pool limit", async () => {
      await expectRevert(smartChef.deposit(parseEther("1"), { from: bob }), "Deposit: Amount above limit");

      assert.equal(await smartChef.hasUserLimit(), true);
    });

    it("User deposit after pool limit is done", async () => {
      await time.advanceBlockTo(startBlock.add(new BN(25)));

      assert.equal(await smartChef.hasUserLimit(), false);

      result = await smartChef.deposit(parseEther("0"), { from: bob });
      assert.equal(String(await smartChef.pendingReward(bob)), "0");
    });
  });
});
