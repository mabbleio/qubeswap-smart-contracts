import { assert } from "chai";
import { constants, expectEvent, expectRevert } from "@openzeppelin/test-helpers";
import { advanceBlockTo } from "@openzeppelin/test-helpers/src/time";
import { artifacts, contract } from "hardhat";
import { parseEther } from "ethers/lib/utils";

const BunnyFactoryV2 = artifacts.require("./old/BunnyFactoryV2.sol");
const BunnyFactoryV3 = artifacts.require("./BunnyFactoryV3.sol");
const BunnyMintingStation = artifacts.require("./BunnyMintingStation.sol");
const MockBEP20 = artifacts.require("./utils/MockBEP20.sol");
const QubeBunnies = artifacts.require("./QubeBunnies.sol");
const QubeProfile = artifacts.require("./QubeProfile.sol");
const TradingCompV1 = artifacts.require("./TradingCompV1.sol");

contract("TradingCompV1", ([alice, bob, carol, david, erin, frank, george, harry]) => {
  const _totalInitSupply = parseEther("50"); // 50 QST
  const _numberQstToReactivate = parseEther("5"); // 5 QST
  const _numberQstToRegister = parseEther("5"); // 5 QST
  const _numberQstToUpdate = parseEther("2"); // 2 QST

  let bunnyFactoryV2, bunnyFactoryV3, bunnyMintingStation, mockQst, qubeBunnies, qubeProfile, tradingComp;

  let DEFAULT_ADMIN_ROLE, MINTER_ROLE, NFT_ROLE, POINT_ROLE;
  let result;

  before(async () => {
    const _tokenPrice = "1000000000000000000"; // 1 QST
    const _ipfsHash = "test/";
    const _endBlockNumberV2 = "3000";
    const _startBlockNumberV2 = "2500";
    const _startBlockNumberV3 = "3000";

    // Deploy MockQST
    mockQst = await MockBEP20.new("Mock QST", "QST", _totalInitSupply, {
      from: alice,
    });

    qubeBunnies = await QubeBunnies.new("ipfs://", { from: alice });

    // Deploy V2
    bunnyFactoryV2 = await BunnyFactoryV2.new(
      qubeBunnies.address,
      mockQst.address,
      _tokenPrice,
      _ipfsHash,
      _startBlockNumberV2,
      _endBlockNumberV2,
      { from: alice }
    );

    // Transfer ownership to BunnyMintingStation
    qubeBunnies.transferOwnership(bunnyFactoryV2.address, {
      from: alice,
    });

    await bunnyFactoryV2.setBunnyNames("MyBunny5", "MyBunny6", "MyBunny7", "MyBunny8", "MyBunny9", {
      from: alice,
    });

    await bunnyFactoryV2.setBunnyJson("test5.json", "test6.json", "test7.json", "test8.json", "test9.json", {
      from: alice,
    });

    await mockQst.mintTokens("1000000000000000000", { from: alice });

    await mockQst.approve(bunnyFactoryV2.address, "1000000000000000000", {
      from: alice,
    });

    await advanceBlockTo(2500);

    await bunnyFactoryV2.mintNFT("6", { from: alice });

    bunnyMintingStation = await BunnyMintingStation.new(qubeBunnies.address);

    bunnyFactoryV3 = await BunnyFactoryV3.new(
      bunnyFactoryV2.address,
      bunnyMintingStation.address,
      mockQst.address,
      _tokenPrice,
      _ipfsHash,
      _startBlockNumberV3,
      { from: alice }
    );

    await bunnyFactoryV2.changeOwnershipNFTContract(bunnyMintingStation.address, {
      from: alice,
    });

    // Deploy Qube Profile
    qubeProfile = await QubeProfile.new(
      mockQst.address,
      _numberQstToReactivate,
      _numberQstToRegister,
      _numberQstToUpdate,
      { from: alice }
    );

    DEFAULT_ADMIN_ROLE = await qubeProfile.DEFAULT_ADMIN_ROLE();
    NFT_ROLE = await qubeProfile.NFT_ROLE();
    POINT_ROLE = await qubeProfile.POINT_ROLE();

    MINTER_ROLE = await bunnyMintingStation.MINTER_ROLE();

    await bunnyMintingStation.grantRole(MINTER_ROLE, bunnyFactoryV3.address, {
      from: alice,
    });

    // Deploy TradingCompV1
    tradingComp = await TradingCompV1.new(qubeProfile.address, bunnyMintingStation.address, mockQst.address, {
      from: alice,
    });
  });

  // Check ticker, symbols, supply, and owners are correct
  describe("Initial contract parameters for all contracts", async () => {
    it("QubeBunnies is correct", async () => {
      assert.equal(await qubeBunnies.name(), "Qube Bunnies");
      assert.equal(await qubeBunnies.symbol(), "PB");
      assert.equal(await qubeBunnies.balanceOf(alice), "1");
      assert.equal(await qubeBunnies.totalSupply(), "1");
      assert.equal(await qubeBunnies.owner(), bunnyMintingStation.address);
    });

    it("MockQST is correct", async () => {
      assert.equal(await mockQst.name(), "Mock QST");
      assert.equal(await mockQst.symbol(), "QST");
    });

    it("QubeProfile is correct", async () => {
      assert.equal(await qubeProfile.qubeswapToken(), mockQst.address);

      for (let role of [NFT_ROLE, POINT_ROLE]) {
        assert.equal(await qubeProfile.getRoleMemberCount(role), "0");
      }

      assert.equal(await qubeProfile.getRoleMemberCount(DEFAULT_ADMIN_ROLE), "1");
    });
  });

  describe("Initial set up", async () => {
    it("Alice adds NFT in the system", async () => {
      result = await qubeProfile.addNftAddress(qubeBunnies.address, {
        from: alice,
      });

      expectEvent(result, "RoleGranted", {
        role: NFT_ROLE,
        account: qubeBunnies.address,
        sender: alice,
      });

      assert.equal(await qubeProfile.getRoleMemberCount(NFT_ROLE), "1");

      await qubeProfile.addTeam("The Testers", "ipfs://hash/team1.json", {
        from: alice,
      });

      await qubeProfile.addTeam("The Second", "ipfs://hash/team2.json", {
        from: alice,
      });
      await qubeProfile.addTeam("The Third", "ipfs://hash/team3.json", {
        from: alice,
      });
    });

    it("Alice adds minting role to TradingCompV1", async () => {
      result = await bunnyMintingStation.grantRole(MINTER_ROLE, tradingComp.address, {
        from: alice,
      });

      expectEvent(result, "RoleGranted", {
        role: MINTER_ROLE,
        account: tradingComp.address,
        sender: alice,
      });

      assert.equal(await bunnyMintingStation.getRoleMemberCount(MINTER_ROLE), "2");

      await advanceBlockTo(3000);
    });

    it("Bob/Carol/David/Erin create a profile in the system", async () => {
      let i = 1;

      for (let thisUser of [bob, carol, david, erin, frank, george, harry]) {
        // User mints 6 QST
        await mockQst.mintTokens(parseEther("6"), { from: thisUser });

        // User approves QST to be spent by BunnyFactoryV3
        await mockQst.approve(bunnyFactoryV3.address, parseEther("1"), {
          from: thisUser,
        });

        // User mints a NFT
        await bunnyFactoryV3.mintNFT("5", { from: thisUser });

        // User approves the contract to receive his NFT
        await qubeBunnies.approve(qubeProfile.address, i, {
          from: thisUser,
        });

        // User approves QST to be spent by QubeProfile
        await mockQst.approve(qubeProfile.address, parseEther("5"), {
          from: thisUser,
        });
        i++;
      }

      // Bob joins team1
      await qubeProfile.createProfile("1", qubeBunnies.address, 1, {
        from: bob,
      });

      // Carol joins team1
      await qubeProfile.createProfile("1", qubeBunnies.address, 2, {
        from: carol,
      });

      // David joins team2
      await qubeProfile.createProfile("2", qubeBunnies.address, 3, {
        from: david,
      });

      // Erin joins team3
      await qubeProfile.createProfile("3", qubeBunnies.address, 4, {
        from: erin,
      });

      // George joins team3
      await qubeProfile.createProfile("3", qubeBunnies.address, 6, {
        from: george,
      });

      // Harry joins team3
      await qubeProfile.createProfile("3", qubeBunnies.address, 7, {
        from: harry,
      });
    });
  });

  describe("General logic", async () => {
    it("Bob/Carol/David/Erin/George/Harry registers his profile", async () => {
      for (let thisUser of [bob, carol, david, erin, george, harry]) {
        result = await tradingComp.claimInformation(thisUser);
        assert.equal(result[0], false);
        assert.equal(result[1], false);
        assert.equal(String(result[2]), "0");
        assert.equal(String(result[3]), "0");
        assert.equal(String(result[4]), "0");
        assert.equal(result[5], false);

        result = await tradingComp.register({
          from: thisUser,
        });

        const thisProfile = await qubeProfile.getUserProfile(thisUser);

        expectEvent(result, "UserRegister", {
          userAddress: thisUser,
          teamId: thisProfile[2].toString(),
        });
        result = await tradingComp.claimInformation(thisUser);
        assert.equal(result[0], true);
        assert.equal(result[1], false);
        assert.equal(String(result[2]), "0");
        assert.equal(String(result[3]), "0");
        assert.equal(String(result[4]), "0");
        assert.equal(result[5], false);
      }
    });

    it("Frank cannot register as he doesn't have profile", async () => {
      await expectRevert(
        tradingComp.register({
          from: frank,
        }),
        "Not registered"
      );

      // Frank joins team3
      await qubeProfile.createProfile("3", qubeBunnies.address, 5, {
        from: frank,
      });
    });

    it("Frank cannot register as he doesn't have profile", async () => {
      // Frank pauses his profile
      await qubeProfile.pauseProfile({ from: frank });

      await expectRevert(
        tradingComp.register({
          from: frank,
        }),
        "NOT_ACTIVE"
      );
    });

    it("Alice launches the trading competition", async () => {
      result = await tradingComp.updateCompetitionStatus(1, { from: alice });
      expectEvent(result, "NewCompetitionStatus", { status: "1" });
    });

    it("Alice finishes the trading competition", async () => {
      result = await tradingComp.updateCompetitionStatus(2, { from: alice });
      expectEvent(result, "NewCompetitionStatus", { status: "2" });
    });

    it("Bob cannot claim rewards until it is in claiming status", async () => {
      await expectRevert(
        tradingComp.claimReward({
          from: bob,
        }),
        "NOT_IN_CLAIMING"
      );
    });
  });

  describe("Reward updates", async () => {
    it("Alice updates team rewards and winning team", async () => {
      result = await tradingComp.updateTeamRewards(
        1,
        [51211000, 51212000, 51213000, 51214000, 51215000],
        [parseEther("0"), parseEther("1"), parseEther("10"), parseEther("100"), parseEther("1000")],
        [10, 50, 100, 300, 1000],
        { from: alice }
      );

      expectEvent(result, "TeamRewardsUpdate", { teamId: "1" });

      result = await tradingComp.updateTeamRewards(
        2,
        [51221000, 51222000, 51223000, 51224000, 51225000],
        [parseEther("0"), parseEther("2"), parseEther("20"), parseEther("200"), parseEther("2000")],
        [20, 100, 200, 600, 2000],
        { from: alice }
      );

      expectEvent(result, "TeamRewardsUpdate", { teamId: "2" });

      result = await tradingComp.updateTeamRewards(
        3,
        [51221000, 51222000, 51223000, 51224000, 51225000],
        [parseEther("0"), parseEther("0.5"), parseEther("5"), parseEther("50"), parseEther("500")],
        [5, 25, 50, 150, 500],
        { from: alice }
      );

      expectEvent(result, "TeamRewardsUpdate", { teamId: "3" });
    });

    it("Alice cannot update status of users to a grade that is too high", async () => {
      await expectRevert(
        tradingComp.updateUserStatusMultiple([bob, carol], "5", {
          from: alice,
        }),
        "TOO_HIGH"
      );
    });

    it("Alice updates 3 user status", async () => {
      await tradingComp.updateUserStatusMultiple([bob, carol], "4", {
        from: alice,
      });

      await tradingComp.updateUserStatusMultiple([david], "2", {
        from: alice,
      });

      await tradingComp.updateUserStatusMultiple([erin], "1", {
        from: alice,
      });
    });

    it("Alice tries to update competition status before winning team is set", async () => {
      await expectRevert(tradingComp.updateCompetitionStatus(3, { from: alice }), "WINNING_TEAM_NOT_SET");

      await expectRevert(
        tradingComp.updateWinningTeamAndTokenURIAndBunnyId(0, "test", "15", {
          from: alice,
        }),
        "NOT_VALID_TEAM_ID"
      );
      await expectRevert(
        tradingComp.updateWinningTeamAndTokenURIAndBunnyId(4, "test", "15", {
          from: alice,
        }),
        "NOT_VALID_TEAM_ID"
      );

      await expectRevert(
        tradingComp.updateWinningTeamAndTokenURIAndBunnyId(3, "test", "14", {
          from: alice,
        }),
        "ID_TOO_LOW"
      );

      result = await tradingComp.updateWinningTeamAndTokenURIAndBunnyId("2", "hash/eastern.json", "15", {
        from: alice,
      });
      expectEvent(result, "WinningTeam", { teamId: "2" });
    });

    it("Alice transfers QST tokens and updates status", async () => {
      await mockQst.mintTokens(parseEther("1000"), { from: alice });
      await mockQst.mintTokens(parseEther("1000"), { from: alice });
      await mockQst.mintTokens(parseEther("1000"), { from: alice });

      await mockQst.transfer(tradingComp.address, parseEther("2021"), {
        from: alice,
      });

      result = await tradingComp.updateCompetitionStatus(3, { from: alice });
      expectEvent(result, "NewCompetitionStatus", { status: "3" });
    });

    it("Alice tries to reclaim QST tokens before it is over", async () => {
      await expectRevert(
        tradingComp.claimRemainder("1", {
          from: alice,
        }),
        "NOT_OVER"
      );
    });

    it("Alice fails to change winning team as it is in claiming status", async () => {
      await expectRevert(
        tradingComp.updateWinningTeamAndTokenURIAndBunnyId(2, "test", "15", {
          from: alice,
        }),
        "NOT_CLOSED"
      );
    });

    it("Alice makes this application a pointAdmin", async () => {
      result = await qubeProfile.grantRole(POINT_ROLE, tradingComp.address, {
        from: alice,
      });

      expectEvent(result, "RoleGranted", {
        role: POINT_ROLE,
        account: tradingComp.address,
        sender: alice,
      });
    });
  });

  describe("Claim updates", async () => {
    it("Bob claims", async () => {
      result = await tradingComp.claimInformation(bob);
      assert.equal(result[0], true);
      assert.equal(result[1], false);
      assert.equal(result[2].toString(), "4");
      assert.equal(String(result[3]), "1000000000000000000000");
      assert.equal(String(result[4]), "1000");
      assert.equal(result[5], false);

      result = await tradingComp.claimReward({ from: bob });

      // Verify events
      expectEvent.inTransaction(result.receipt.transactionHash, mockQst, "Transfer", {
        from: tradingComp.address,
        to: bob,
        value: "1000000000000000000000",
      });

      expectEvent.inTransaction(result.receipt.transactionHash, qubeProfile, "UserPointIncrease", {
        userAddress: bob,
        numberPoints: "1000",
        campaignId: "51215000",
      });

      // Verify events
      expectEvent.notEmitted.inTransaction(result.receipt.transactionHash, qubeBunnies, "Transfer");

      // Verify points and balances are ok
      result = await mockQst.balanceOf(bob);
      assert.deepEqual(result.toString(), String(parseEther("1000")));
      result = await qubeProfile.getUserProfile(bob);
      assert.equal(result[1].toString(), "1000");

      result = await tradingComp.claimInformation(bob);
      assert.equal(result[0], true);
      assert.equal(result[1], true);
      assert.equal(String(result[2]), "4");
      assert.equal(String(result[3]), "1000000000000000000000");
      assert.equal(String(result[4]), "1000");
      assert.equal(result[5], false);
    });

    it("Carol claims", async () => {
      result = await tradingComp.claimInformation(carol);
      assert.equal(result[0], true);
      assert.equal(result[1], false);
      assert.equal(String(result[2]), "4");
      assert.equal(String(result[3]), "1000000000000000000000");
      assert.equal(String(result[4]), "1000");
      assert.equal(result[5], false);

      result = await tradingComp.claimReward({ from: carol });

      // Verify events
      expectEvent.inTransaction(result.receipt.transactionHash, mockQst, "Transfer", {
        from: tradingComp.address,
        to: carol,
        value: "1000000000000000000000",
      });

      expectEvent.inTransaction(result.receipt.transactionHash, qubeProfile, "UserPointIncrease", {
        userAddress: carol,
        numberPoints: "1000",
        campaignId: "51215000",
      });

      // Verify events
      expectEvent.notEmitted.inTransaction(result.receipt.transactionHash, qubeBunnies, "Transfer");

      // Verify points and balances are ok
      result = await mockQst.balanceOf(carol);
      assert.deepEqual(result.toString(), String(parseEther("1000")));
      result = await qubeProfile.getUserProfile(carol);
      assert.equal(result[1].toString(), "1000");

      result = await tradingComp.claimInformation(carol);
      assert.equal(result[0], true);
      assert.equal(result[1], true);
      assert.equal(String(result[2]), "4");
      assert.equal(String(result[3]), "1000000000000000000000");
      assert.equal(String(result[4]), "1000");
      assert.equal(result[5], false);
    });

    it("David claims", async () => {
      result = await tradingComp.claimInformation(david);
      assert.equal(result[0], true);
      assert.equal(result[1], false);
      assert.equal(String(result[2]), "2");
      assert.equal(String(result[3]), "20000000000000000000");
      assert.equal(String(result[4]), "200");
      assert.equal(result[5], true);

      result = await tradingComp.claimReward({ from: david });

      // Verify events
      expectEvent.inTransaction(result.receipt.transactionHash, mockQst, "Transfer", {
        from: tradingComp.address,
        to: david,
        value: "20000000000000000000",
      });

      expectEvent.inTransaction(result.receipt.transactionHash, qubeProfile, "UserPointIncrease", {
        userAddress: david,
        numberPoints: "200",
        campaignId: "51223000",
      });

      // Verify events
      expectEvent.inTransaction(result.receipt.transactionHash, qubeBunnies, "Transfer", {
        from: constants.ZERO_ADDRESS,
        to: david,
        tokenId: "8",
      });

      // Verify points and balances are ok
      result = await mockQst.balanceOf(david);
      assert.deepEqual(result.toString(), String(parseEther("20")));
      result = await qubeProfile.getUserProfile(david);
      assert.equal(result[1].toString(), "200");

      result = await tradingComp.claimInformation(david);
      assert.equal(result[0], true);
      assert.equal(result[1], true);
      assert.equal(String(result[2]), "2");
      assert.equal(String(result[3]), "20000000000000000000");
      assert.equal(String(result[4]), "200");
      assert.equal(result[5], true);
    });

    it("Erin claims", async () => {
      result = await tradingComp.claimInformation(erin);
      assert.equal(result[0], true);
      assert.equal(result[1], false);
      assert.equal(String(result[2]), "1");
      assert.equal(String(result[3]), "500000000000000000");
      assert.equal(String(result[4]), "25");
      assert.equal(result[5], false);

      result = await tradingComp.claimReward({ from: erin });

      // Verify events
      expectEvent.inTransaction(result.receipt.transactionHash, mockQst, "Transfer", {
        from: tradingComp.address,
        to: erin,
        value: "500000000000000000",
      });

      expectEvent.inTransaction(result.receipt.transactionHash, qubeProfile, "UserPointIncrease", {
        userAddress: erin,
        numberPoints: "25",
        campaignId: "51222000",
      });

      expectEvent.notEmitted.inTransaction(result.receipt.transactionHash, qubeBunnies, "Transfer");

      // Verify points and balances are ok
      result = await mockQst.balanceOf(erin);
      assert.deepEqual(result.toString(), String(parseEther("0.5")));
      result = await qubeProfile.getUserProfile(erin);
      assert.equal(result[1].toString(), "25");

      result = await tradingComp.claimInformation(erin);
      assert.equal(result[0], true);
      assert.equal(result[1], true);
      assert.equal(String(result[2]), "1");
      assert.equal(String(result[3]), "500000000000000000");
      assert.equal(String(result[4]), "25");
      assert.equal(result[5], false);
    });

    it("George claims", async () => {
      result = await tradingComp.claimInformation(george);
      assert.equal(result[0], true);
      assert.equal(result[1], false);
      assert.equal(String(result[2]), "0");
      assert.equal(String(result[3]), "0");
      assert.equal(String(result[4]), "5");
      assert.equal(result[5], false);

      result = await tradingComp.claimReward({ from: george });

      expectEvent.inTransaction(result.receipt.transactionHash, qubeProfile, "UserPointIncrease", {
        userAddress: george,
        numberPoints: "5",
        campaignId: "51221000",
      });

      expectEvent.notEmitted.inTransaction(result.receipt.transactionHash, mockQst, "Transfer");

      expectEvent.notEmitted.inTransaction(result.receipt.transactionHash, qubeBunnies, "Transfer");

      // Verify points and balances are ok
      result = await mockQst.balanceOf(george);
      assert.deepEqual(result.toString(), String(parseEther("0")));
      result = await qubeProfile.getUserProfile(george);
      assert.equal(result[1].toString(), "5");

      result = await tradingComp.claimInformation(george);
      assert.equal(result[0], true);
      assert.equal(result[1], true);
      assert.equal(result[2], "0");
      assert.equal(String(result[3]), "0");
      assert.equal(String(result[4]), "5");
      assert.equal(result[5], false);
    });

    it("Frank's status returns that he cannot claim", async () => {
      result = await tradingComp.claimInformation(frank);
      assert.equal(result[0], false);
      assert.equal(result[1], false);
      assert.equal(String(result[2]), "0");
      assert.equal(String(result[3]), "0");
      assert.equal(String(result[4]), "0");
      assert.equal(result[5], false);
    });

    it("Alice updates the competition status to OVER", async () => {
      result = await tradingComp.claimInformation(harry);
      assert.equal(result[0], true);
      assert.equal(result[1], false);
      assert.equal(String(result[2]), "0");
      assert.equal(String(result[3]), "0");
      assert.equal(String(result[4]), "5");
      assert.equal(result[5], false);

      result = await tradingComp.updateCompetitionStatus("4", {
        from: alice,
      });

      expectEvent(result, "NewCompetitionStatus", { status: "4" });

      result = await tradingComp.claimInformation(harry);
      assert.equal(result[0], true);
      assert.equal(result[1], false);
      assert.equal(String(result[2]), "0");
      assert.equal(String(result[3]), "0");
      assert.equal(String(result[4]), "5");
      assert.equal(result[5], false);
    });

    it("Alice claims the QST remainder from the contract", async () => {
      await tradingComp.claimRemainder(parseEther("0.5"), { from: alice });
      result = await mockQst.balanceOf(tradingComp.address);
      assert.equal(result.toString(), "0");
    });
  });

  describe("Unexpected actions", async () => {
    it("Erin cannot claim again", async () => {
      await expectRevert(
        tradingComp.claimReward({
          from: erin,
        }),
        "HAS_CLAIMED"
      );
    });

    it("Harry cannot claim after the competition is over", async () => {
      await expectRevert(
        tradingComp.claimReward({
          from: harry,
        }),
        "NOT_IN_CLAIMING"
      );
    });

    it("Frank cannot claim as he hasn't registered", async () => {
      await expectRevert(
        tradingComp.claimReward({
          from: frank,
        }),
        "NOT_REGISTERED"
      );
    });

    it("Frank cannot register", async () => {
      await expectRevert(
        tradingComp.register({
          from: frank,
        }),
        "NOT_IN_REGISTRATION"
      );
    });

    it("Bob cannot register", async () => {
      await expectRevert(
        tradingComp.register({
          from: bob,
        }),
        "HAS_REGISTERED"
      );
    });
    it("Admin cannot update competition status in unwanted ways", async () => {
      await expectRevert(
        tradingComp.updateCompetitionStatus("0", {
          from: alice,
        }),
        "IN_REGISTRATION"
      );
      await expectRevert(
        tradingComp.updateCompetitionStatus("1", {
          from: alice,
        }),
        "NOT_IN_REGISTRATION"
      );
      await expectRevert(
        tradingComp.updateCompetitionStatus("2", {
          from: alice,
        }),
        "NOT_OPEN"
      );
      await expectRevert(
        tradingComp.updateCompetitionStatus("3", {
          from: alice,
        }),
        "NOT_CLOSED"
      );
      await expectRevert(
        tradingComp.updateCompetitionStatus("4", {
          from: alice,
        }),
        "NOT_CLAIMING"
      );

      // It reverts without an exception since CompetitionStatus is 0-4
      await expectRevert.unspecified(
        tradingComp.updateCompetitionStatus("5", {
          from: alice,
        })
      );
    });

    it("Admin cannot change user/team rewards at an unwanted competition stage", async () => {
      await expectRevert(
        tradingComp.updateTeamRewards(
          1,
          [51211000, 51212000, 51213000, 51214000, 51215000],
          [parseEther("0"), parseEther("1"), parseEther("10"), parseEther("100"), parseEther("1000")],
          [10, 50, 100, 300, 1000],
          { from: alice }
        ),
        "NOT_CLOSED"
      );

      await expectRevert(
        tradingComp.updateUserStatusMultiple([bob, carol], "4", {
          from: alice,
        }),
        "NOT_CLOSED"
      );
    });
  });

  describe("Unexpected actions", async () => {
    it("Owner functions can only be triggered by admin", async () => {
      await expectRevert(
        tradingComp.claimRemainder("10", {
          from: bob,
        }),
        "Ownable: caller is not the owner"
      );

      await expectRevert(
        tradingComp.updateCompetitionStatus("0", {
          from: bob,
        }),
        "Ownable: caller is not the owner"
      );

      await expectRevert(
        tradingComp.updateUserStatusMultiple([bob, carol], "2", {
          from: bob,
        }),
        "Ownable: caller is not the owner"
      );

      await expectRevert(
        tradingComp.updateTeamRewards(
          1,
          [51211000, 51212000, 51213000, 51214000, 51215000],
          [parseEther("0"), parseEther("1"), parseEther("10"), parseEther("100"), parseEther("1000")],
          [10, 50, 100, 300, 1000],
          { from: bob }
        ),
        "Ownable: caller is not the owner"
      );
    });
  });
});
