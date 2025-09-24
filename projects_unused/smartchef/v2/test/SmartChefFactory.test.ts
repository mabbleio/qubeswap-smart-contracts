import { parseEther } from "ethers/lib/utils";
import { artifacts, contract } from "hardhat";
import { assert } from "chai";
import { BN, expectEvent, expectRevert, time, constants } from "@openzeppelin/test-helpers";

const SmartChefFactory = artifacts.require("./SmartChefFactory");
const SmartChefInitializable = artifacts.require("./SmartChefInitializable");
const MockERC20 = artifacts.require("./libs/MockERC20");
const MockERC721 = artifacts.require("./test/MockERC721");
const QubeProfile = artifacts.require("./test/MockQubeProfile");

contract("Smart Chef Factory", ([alice, bob, carol, david, erin, ...accounts]) => {
  let blockNumber;
  let startBlock;
  let endBlock;

  let poolLimitPerUser = parseEther("0");
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

  describe("SMART CHEF #1 - NO POOL LIMIT", async () => {
    it("Deploy pool with SmartChefFactory", async () => {
      result = await smartChefFactory.deployPool(
        mockQST.address,
        mockPT.address,
        rewardPerBlock,
        startBlock,
        endBlock,
        poolLimitPerUser,
        0,
        qubeProfile.address,
        true,
        0,
        alice
      );

      const poolAddress = result.receipt.logs[2].args[0];

      expectEvent(result, "NewSmartChefContract", { smartChef: poolAddress });

      smartChef = await SmartChefInitializable.at(poolAddress);
    });

    it("Initial parameters are correct", async () => {
      assert.equal(String(await smartChef.PRECISION_FACTOR()), "1000000000000");
      assert.equal(String(await smartChef.lastRewardBlock()), startBlock);
      assert.equal(String(await smartChef.rewardPerBlock()), rewardPerBlock.toString());
      assert.equal(String(await smartChef.poolLimitPerUser()), poolLimitPerUser.toString());
      assert.equal(String(await smartChef.startBlock()), startBlock.toString());
      assert.equal(String(await smartChef.bonusEndBlock()), endBlock.toString());
      assert.equal(await smartChef.hasUserLimit(), false);
      assert.equal(await smartChef.owner(), alice);

      // Transfer 4000 PT token to the contract (400 blocks with 10 PT/block)
      await mockPT.transfer(smartChef.address, parseEther("4000"), { from: alice });
    });

    it("Users deposit", async () => {
      let i = 0;
      for (let thisUser of [bob, carol, david, erin]) {
        await mockQST.mintTokens(parseEther("1000"), { from: thisUser });
        await mockQST.approve(smartChef.address, parseEther("1000"), {
          from: thisUser,
        });
        await mockQubeBunnies.mint({ from: thisUser });
        await mockQubeBunnies.setApprovalForAll(qubeProfile.address, true, { from: thisUser });
        await mockQST.approve(qubeProfile.address, constants.MAX_UINT256, { from: thisUser });
        await qubeProfile.createProfile("1", mockQubeBunnies.address, i.toString(), { from: thisUser });
        result = await smartChef.deposit(parseEther("100"), { from: thisUser });
        expectEvent(result, "Deposit", { user: thisUser, amount: String(parseEther("100")) });
        assert.equal(String(await smartChef.pendingReward(thisUser)), "0");
        i++;
      }
    });

    it("Advance to startBlock", async () => {
      await time.advanceBlockTo(startBlock);
      assert.equal(String(await smartChef.pendingReward(bob)), "0");
    });

    it("Advance to startBlock + 1", async () => {
      await time.advanceBlockTo(startBlock.add(new BN(1)));
      assert.equal(String(await smartChef.pendingReward(bob)), String(parseEther("2.5")));
    });

    it("Advance to startBlock + 10", async () => {
      await time.advanceBlockTo(startBlock.add(new BN(10)));
      assert.equal(String(await smartChef.pendingReward(carol)), String(parseEther("25")));
    });

    it("Carol can withdraw", async () => {
      result = await smartChef.withdraw(parseEther("50"), { from: carol });
      expectEvent(result, "Withdraw", { user: carol, amount: String(parseEther("50")) });
      // She harvests 11 blocks --> 10/4 * 11 = 27.5 PT tokens
      assert.equal(String(await mockPT.balanceOf(carol)), String(parseEther("27.5")));
      assert.equal(String(await smartChef.pendingReward(carol)), String(parseEther("0")));
    });

    it("Can collect rewards by calling deposit with amount = 0", async () => {
      result = await smartChef.deposit(parseEther("0"), { from: carol });
      expectEvent(result, "Deposit", { user: carol, amount: String(parseEther("0")) });
      assert.equal(String(await mockPT.balanceOf(carol)), String(parseEther("28.92857142855")));
    });

    it("Can collect rewards by calling withdraw with amount = 0", async () => {
      result = await smartChef.withdraw(parseEther("0"), { from: carol });
      expectEvent(result, "Withdraw", { user: carol, amount: String(parseEther("0")) });
      assert.equal(String(await mockPT.balanceOf(carol)), String(parseEther("30.3571428571")));
    });

    it("Carol cannot withdraw more than she had", async () => {
      await expectRevert(smartChef.withdraw(parseEther("70"), { from: carol }), "Amount to withdraw too high");
    });

    it("Admin cannot set a limit", async () => {
      await expectRevert(smartChef.updatePoolLimitPerUser(true, parseEther("1"), { from: alice }), "Must be set");
    });

    it("Cannot change after start reward per block, nor start block or end block", async () => {
      await expectRevert(smartChef.updateRewardPerBlock(parseEther("1"), { from: alice }), "Pool has started");
      await expectRevert(smartChef.updateStartAndEndBlocks("1", "10", { from: alice }), "Pool has started");
    });

    it("Advance to end of IFO", async () => {
      await time.advanceBlockTo(endBlock);

      for (let thisUser of [bob, david, erin]) {
        await smartChef.withdraw(parseEther("100"), { from: thisUser });
      }
      await smartChef.withdraw(parseEther("50"), { from: carol });

      // 0.000000001 PT token
      assert.isAtMost(Number(await mockPT.balanceOf(smartChef.address)), 1000000000);
    });

    it("Cannot deploy a pool with SmartChefFactory if not owner", async () => {
      await expectRevert(
        smartChefFactory.deployPool(
          mockQST.address,
          mockPT.address,
          rewardPerBlock,
          startBlock,
          endBlock,
          poolLimitPerUser,
          0,
          qubeProfile.address,
          true,
          0,
          bob,
          { from: bob }
        ),
        "Ownable: caller is not the owner"
      );
    });

    it("Cannot deploy a pool with wrong tokens", async () => {
      await expectRevert(
        smartChefFactory.deployPool(
          mockQST.address,
          mockQST.address,
          rewardPerBlock,
          startBlock,
          endBlock,
          poolLimitPerUser,
          0,
          qubeProfile.address,
          true,
          0,
          alice,
          { from: alice }
        ),
        "Tokens must be be different"
      );

      await expectRevert(
        smartChefFactory.deployPool(
          mockQST.address,
          smartChef.address,
          rewardPerBlock,
          startBlock,
          endBlock,
          poolLimitPerUser,
          0,
          qubeProfile.address,
          true,
          0,
          alice,
          { from: alice }
        ),
        "function selector was not recognized and there's no fallback function"
      );

      await expectRevert(
        smartChefFactory.deployPool(
          alice,
          mockQST.address,
          rewardPerBlock,
          startBlock,
          endBlock,
          poolLimitPerUser,
          0,
          qubeProfile.address,
          true,
          0,
          alice,
          { from: alice }
        ),
        "function call to a non-contract account"
      );
    });
  });

  describe("Owner can use recoverToken", async () => {
    let amount = parseEther("100").toString();

    it("Owner can recover token", async () => {
      await fakeQst.transfer(smartChef.address, amount, { from: alice });

      result = await smartChef.recoverToken(fakeQst.address, { from: alice });

      expectEvent(result, "TokenRecovery", {
        token: fakeQst.address,
        amount: amount,
      });

      expectEvent.inTransaction(result.receipt.transactionHash, fakeQst, "Transfer", {
        from: smartChef.address,
        to: alice,
        value: amount,
      });
    });

    it("Owner cannot recover token if balance is zero", async () => {
      await expectRevert(
        smartChef.recoverToken(fakeQst.address, { from: alice }),
        "Operations: Cannot recover zero balance"
      );
    });

    it("Owner cannot recover staked token", async () => {
      await expectRevert(
        smartChef.recoverToken(mockQST.address, { from: alice }),
        "Operations: Cannot recover staked token"
      );
    });

    it("Owner cannot recover reward token", async () => {
      await expectRevert(
        smartChef.recoverToken(mockPT.address, { from: alice }),
        "Operations: Cannot recover reward token"
      );
    });
  });
});
