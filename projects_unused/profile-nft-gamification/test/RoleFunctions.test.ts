import { assert } from "chai";
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers";
import { gasToBNB, gasToUSD } from "./helpers/GasCalculation";

import { artifacts, contract } from "hardhat";

const MockAdmin = artifacts.require("./utils/MockAdmin.sol");
const MockBunnies = artifacts.require("./utils/MockBunnies.sol");
const MockBEP20 = artifacts.require("./utils/MockBEP20.sol");
const MockCats = artifacts.require("./utils/MockCats.sol");
const QubeProfile = artifacts.require("./QubeProfile.sol");

contract("Admin and point system logic", ([alice, bob, carol, david, erin, frank]) => {
  const _totalInitSupply = "50000000000000000000"; // 50 QST
  const _numberQstToReactivate = "5000000000000000000";
  const _numberQstToRegister = "5000000000000000000"; // 5 QST
  const _numberQstToUpdate = "2000000000000000000"; // 2 QST

  let mockAdmin, mockBunnies, mockCats, mockQst, qubeProfile;
  let DEFAULT_ADMIN_ROLE, NFT_ROLE, POINT_ROLE, SPECIAL_ROLE;
  let result;

  before(async () => {
    mockQst = await MockBEP20.new("Mock QST", "QST", _totalInitSupply, {
      from: alice,
    });

    mockBunnies = await MockBunnies.new({ from: alice });

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
    SPECIAL_ROLE = await qubeProfile.SPECIAL_ROLE();
  });

  // Check ticker, symbols, supply, and owners are correct
  describe("Initial contract parameters for all contracts", async () => {
    it("MockBunnies is correct", async () => {
      assert.equal(await mockBunnies.name(), "Mock Bunnies");
      assert.equal(await mockBunnies.symbol(), "MB");
      assert.equal(await mockBunnies.balanceOf(alice), "0");
      assert.equal(await mockBunnies.totalSupply(), "0");
      assert.equal(await mockBunnies.owner(), alice);
    });
    it("MockQST is correct", async () => {
      assert.equal(await mockQst.name(), "Mock QST");
      assert.equal(await mockQst.symbol(), "QST");
      assert.equal(await mockQst.balanceOf(alice), "50000000000000000000");
      assert.equal(await mockQst.totalSupply(), "50000000000000000000");
    });
    it("QubeProfile is correct", async () => {
      assert.equal(await qubeProfile.qubeswapToken(), mockQst.address);
      assert.equal(await qubeProfile.numberQstToReactivate(), _numberQstToReactivate);
      assert.equal(await qubeProfile.numberQstToRegister(), _numberQstToRegister);
      assert.equal(await qubeProfile.numberQstToUpdate(), _numberQstToUpdate);

      for (let role of [SPECIAL_ROLE, NFT_ROLE, POINT_ROLE]) {
        assert.equal(await qubeProfile.getRoleMemberCount(role), "0");
      }

      assert.equal(await qubeProfile.getRoleMemberCount(DEFAULT_ADMIN_ROLE), "1");
    });
  });
  describe("Admin logic and team point increases", async () => {
    it("Bob creates a profile in the system", async () => {
      result = await qubeProfile.addNftAddress(mockBunnies.address, {
        from: alice,
      });

      expectEvent(result, "RoleGranted", {
        role: NFT_ROLE,
        account: mockBunnies.address,
        sender: alice,
      });

      assert.equal(await qubeProfile.getRoleMemberCount(NFT_ROLE), "1");

      await qubeProfile.addTeam("The Testers", "ipfs://hash/team1.json", {
        from: alice,
      });

      // Bob mints a NFT
      await mockBunnies.mint({ from: bob });

      // Bob approves the contract to receive his NFT
      await mockBunnies.approve(qubeProfile.address, "0", {
        from: bob,
      });

      // Bob mints 10 QST
      for (let i = 0; i < 5; i++) {
        await mockQst.mintTokens("2000000000000000000", { from: bob });
      }

      // Bob approves QST to be spent
      await mockQst.approve(qubeProfile.address, "5000000000000000000", {
        from: bob,
      });

      // Bob can create his profile
      await qubeProfile.createProfile("1", mockBunnies.address, "0", {
        from: bob,
      });

      // Verify the team profile data is accurate
      result = await qubeProfile.getTeamProfile("1");
      assert.equal(result[0], "The Testers");
      assert.equal(result[1], "ipfs://hash/team1.json");
      assert.equal(result[2].toString(), "1");
      assert.equal(result[3].toString(), "0"); // Number of points for the team
      assert.equal(result[4], true);
    });

    it("MockAdmin is deployed with correct parameters", async () => {
      mockAdmin = await MockAdmin.new(qubeProfile.address, {
        from: alice,
      });

      assert.equal(await mockAdmin.numberFreePoints(), "88");
      assert.equal(await mockAdmin.qubeProfileAddress(), qubeProfile.address);
    });

    it("Alice cannot increase points if she is not a point admin", async () => {
      // Alice cannot increase number of points of the first team
      await expectRevert(
        mockAdmin.increaseTeamPointsPP("1", "100", {
          from: alice,
        }),
        "Not a point admin"
      );
    });

    it("Alice adds MockAdmin as point admin in QubeProfile", async () => {
      result = await qubeProfile.grantRole(POINT_ROLE, mockAdmin.address, {
        from: alice,
      });

      expectEvent(result, "RoleGranted", {
        role: POINT_ROLE,
        account: mockAdmin.address,
        sender: alice,
      });

      assert.equal(await qubeProfile.getRoleMemberCount(POINT_ROLE), "1");
    });

    it("Alice increases number of points through the MockAdmin", async () => {
      result = await mockAdmin.increaseTeamPointsPP("1", "100", {
        from: alice,
      });

      // Verify events
      expectEvent.inTransaction(result.receipt.transactionHash, qubeProfile, "TeamPointIncrease", {
        teamId: "1",
        numberPoints: "100",
        campaignId: "511012101",
      });

      // Verify the number of team points is 100
      result = await qubeProfile.getTeamProfile("1");
      assert.equal(result[3], "100");
    });
  });

  describe("Point functions for a single user", async () => {
    it("Bob can only claim user points and it is reflected in his profile", async () => {
      result = await qubeProfile.getUserProfile(bob);
      assert.equal(result[1], "0");
      result = await mockAdmin.increaseUserPointsPP({ from: bob });

      // Verify events
      expectEvent.inTransaction(result.receipt.transactionHash, qubeProfile, "UserPointIncrease", {
        userAddress: bob,
        numberPoints: "88",
        campaignId: "711012101",
      });

      // Check it was updated properly
      result = await qubeProfile.getUserProfile(bob);
      assert.equal(result[1], "88");
    });

    it("Bob can only claim user points once", async () => {
      await expectRevert(mockAdmin.increaseUserPointsPP({ from: bob }), "has claimed");
    });

    it("Carol cannot increase her points if not active", async () => {
      await expectRevert(mockAdmin.increaseUserPointsPP({ from: carol }), "not active");
    });

    it("Carol cannot receive points if her user status is paused", async () => {
      // Carol mints a NFT
      await mockBunnies.mint({ from: carol });

      // Carol approves the contract to receive her NFT
      await mockBunnies.approve(qubeProfile.address, "1", {
        from: carol,
      });

      // Carol mints 10 QST
      for (let i = 0; i < 5; i++) {
        await mockQst.mintTokens("2000000000000000000", { from: carol });
      }

      // Carol approves QST to be spent
      await mockQst.approve(qubeProfile.address, "10000000000000000000", {
        from: carol,
      });

      // Carol creates her profile
      await qubeProfile.createProfile("1", mockBunnies.address, "1", {
        from: carol,
      });

      // Carol pauses her profile
      result = await qubeProfile.pauseProfile({
        from: carol,
      });

      expectEvent(result, "UserPause", {
        userAddress: carol,
        teamId: "1",
      });

      // Carol cannot increase her number of points since she is unactive
      await expectRevert(
        mockAdmin.increaseUserPointsPP({
          from: carol,
        }),
        "not active"
      );
    });

    it("Carol can receive points after she reactivates her profile", async () => {
      // Carol re-approves the contract to receive his NFT
      await mockBunnies.approve(qubeProfile.address, "1", {
        from: carol,
      });

      // Carol reactivates her profile
      await qubeProfile.reactivateProfile(mockBunnies.address, "1", {
        from: carol,
      });

      // Carol gets her points
      result = await mockAdmin.increaseUserPointsPP({
        from: carol,
      });

      // Verify events
      expectEvent.inTransaction(result.receipt.transactionHash, qubeProfile, "UserPointIncrease", {
        userAddress: carol,
        numberPoints: "88",
        campaignId: "711012101",
      });

      // Check it was updated properly
      result = await qubeProfile.getUserProfile(carol);
      assert.equal(result[1], "88");
    });

    it("Only an active admin can conduct point operations", async () => {
      // David mints a NFT
      await mockBunnies.mint({ from: david });

      // David approves the contract to receive his NFT
      await mockBunnies.approve(qubeProfile.address, "2", {
        from: david,
      });

      // David mints 10 QST
      for (let i = 0; i < 5; i++) {
        await mockQst.mintTokens("2000000000000000000", { from: david });
      }

      // David approves QST to be spent
      await mockQst.approve(qubeProfile.address, "5000000000000000000", {
        from: david,
      });

      // David creates her profile
      await qubeProfile.createProfile("1", mockBunnies.address, "2", {
        from: david,
      });

      // Alice removes the admin contract as valid
      result = await qubeProfile.revokeRole(POINT_ROLE, mockAdmin.address, {
        from: alice,
      });

      expectEvent(result, "RoleRevoked", {
        role: POINT_ROLE,
        account: mockAdmin.address,
        sender: alice,
      });

      assert.equal(await qubeProfile.getRoleMemberCount(POINT_ROLE), "0");

      // David cannot increase his points since contract is not admin
      await expectRevert(
        mockAdmin.increaseUserPointsPP({
          from: david,
        }),
        "Not a point admin"
      );

      // Alice cannot increase team points despite being contract owner (she is not admin)
      await expectRevert(
        mockAdmin.increaseTeamPointsPP("1", "100", {
          from: alice,
        }),
        "Not a point admin"
      );

      // Alice cannot increase points of multiple users because she is owner, not admin
      await expectRevert(
        mockAdmin.increaseUserPointsMultiplePP([bob, carol, david], "100", {
          from: alice,
        }),
        "Not a point admin"
      );
    });

    it("Multi-point increases works as expected", async () => {
      // Alice re-adds the contract as admin
      result = await qubeProfile.grantRole(POINT_ROLE, mockAdmin.address, {
        from: alice,
      });

      expectEvent(result, "RoleGranted", {
        role: POINT_ROLE,
        account: mockAdmin.address,
        sender: alice,
      });

      assert.equal(await qubeProfile.getRoleMemberCount(POINT_ROLE), "1");

      // David increases his points
      result = await mockAdmin.increaseUserPointsPP({
        from: david,
      });

      // Verify events
      expectEvent.inTransaction(result.receipt.transactionHash, qubeProfile, "UserPointIncrease", {
        userAddress: david,
        numberPoints: "88",
        campaignId: "711012101",
      });

      // Check it was updated properly
      result = await qubeProfile.getUserProfile(david);
      assert.equal(result[1], "88");

      // Alice increases number of points of Bob, Carol, David by 100 points
      result = await mockAdmin.increaseUserPointsMultiplePP([bob, carol, david], "100", {
        from: alice,
      });

      // Verify events
      expectEvent.inTransaction(result.receipt.transactionHash, qubeProfile, "UserPointIncreaseMultiple", {
        userAddresses: [bob, carol, david],
        numberPoints: "100",
        campaignId: "811012101",
      });

      // Check points were updated for all 3 users (method 2)
      for (let thisUser of [bob, carol, david]) {
        result = await qubeProfile.getUserProfile(thisUser);
        assert.equal(result[1], "188");
      }
    });
  });

  describe("Owner functions", async () => {
    it("Only the owner can call owner functions", async () => {
      // addNftAddress
      await expectRevert(
        qubeProfile.addNftAddress(alice, {
          from: bob,
        }),
        "Not the main admin"
      );

      // addTeam
      await expectRevert(
        qubeProfile.addTeam("The Cheaters", "ipfs://hash/team2.json", {
          from: bob,
        }),
        "Not the main admin"
      );

      // claimFee
      await expectRevert(
        qubeProfile.claimFee("10000000000", {
          from: bob,
        }),
        "Not the main admin"
      );

      // makeTeamJoinable
      await expectRevert(
        qubeProfile.makeTeamJoinable("1", {
          from: bob,
        }),
        "Not the main admin"
      );

      // makeTeamNotJoinable
      await expectRevert(
        qubeProfile.makeTeamNotJoinable("1", {
          from: bob,
        }),
        "Not the main admin"
      );

      // renameTeam
      await expectRevert(
        qubeProfile.renameTeam("1", "The Cheaters", "ipfs://hash/team2.json", {
          from: bob,
        }),
        "Not the main admin"
      );

      // updateNumberQst
      await expectRevert(
        qubeProfile.updateNumberQst("10000000000", "10000000000", "10000000000", {
          from: bob,
        }),
        "Not the main admin"
      );
    });

    it("Functions to rename teams work", async () => {
      await expectRevert(
        qubeProfile.renameTeam("0", "Team Not There", "ipfs://hash/team3.json", {
          from: alice,
        }),
        "teamId invalid"
      );

      await expectRevert(
        qubeProfile.renameTeam("3", "Team Not There", "ipfs://hash/team3.json", {
          from: alice,
        }),
        "teamId invalid"
      );

      await expectRevert(qubeProfile.renameTeam("1", "BOB", { from: alice }), "Must be > 3");

      await expectRevert(
        qubeProfile.renameTeam("1", "ABCDEFGHIJKLMNOPQRST", {
          from: alice,
        }),
        "Must be < 20"
      );

      result = await qubeProfile.renameTeam("1", "The Bosses", "ipfs://newHash/team1.json", {
        from: alice,
      });

      result = await qubeProfile.getTeamProfile("1");

      assert.equal(result[0], "The Bosses");
      assert.equal(result[1], "ipfs://newHash/team1.json");
    });

    it("Function to remove user points works", async () => {
      result = await qubeProfile.grantRole(POINT_ROLE, frank, {
        from: alice,
      });

      expectEvent(result, "RoleGranted", {
        role: POINT_ROLE,
        account: frank,
        sender: alice,
      });

      await expectRevert(
        qubeProfile.removeUserPoints(frank, "10", {
          from: alice,
        }),
        "Not a point admin"
      );

      // Frank has 0 point
      await expectRevert(
        qubeProfile.removeUserPoints(frank, "10", {
          from: frank,
        }),
        "SafeMath: subtraction overflow"
      );

      await qubeProfile.removeUserPoints(david, "10", {
        from: frank,
      });

      // David has 188 - 10  = 178 points
      result = await qubeProfile.getUserProfile(david);
      assert.equal(result[1].toString(), "178");
    });

    it("Function to remove multiple user points works", async () => {
      await expectRevert(
        qubeProfile.removeUserPoints(frank, "10", {
          from: alice,
        }),
        "Not a point admin"
      );

      // They all have less than 200
      await expectRevert(
        qubeProfile.removeUserPointsMultiple([bob, carol, david], "200", {
          from: frank,
        }),
        "SafeMath: subtraction overflow"
      );

      // Only David has less than 180
      await expectRevert(
        qubeProfile.removeUserPointsMultiple([bob, carol, david], "180", {
          from: frank,
        }),
        "SafeMath: subtraction overflow"
      );

      await qubeProfile.removeUserPointsMultiple([bob, carol, david], "10", {
        from: frank,
      });

      // David has 178 - 10  = 168 points
      result = await qubeProfile.getUserProfile(david);
      assert.equal(result[1].toString(), "168");

      // Bob has 188 - 10  = 178 points
      result = await qubeProfile.getUserProfile(bob);
      assert.equal(result[1].toString(), "178");

      // Carol has 188 - 10  = 178 points
      result = await qubeProfile.getUserProfile(carol);
      assert.equal(result[1].toString(), "178");
    });

    it("Function to remove multiple user points works", async () => {
      await expectRevert(
        qubeProfile.removeTeamPoints("1", "10", {
          from: alice,
        }),
        "Not a point admin"
      );

      // Team 1 has less than 20,000 points
      await expectRevert(
        qubeProfile.removeTeamPoints("1", "20000", {
          from: frank,
        }),
        "SafeMath: subtraction overflow"
      );

      result = await qubeProfile.getTeamProfile("1");
      assert.equal(result[3].toString(), "100");

      await qubeProfile.removeTeamPoints("1", "50", {
        from: frank,
      });

      // 100 - 50 = 50 points
      result = await qubeProfile.getTeamProfile("1");
      assert.equal(result[3].toString(), "50");
    });
    it("Functions to make a team not joinable works", async () => {
      // Erin mints a NFT
      await mockBunnies.mint({ from: erin });

      // Erinn approves the contract to receive her NFT
      await mockBunnies.approve(qubeProfile.address, "3", {
        from: erin,
      });

      // Erin mints 10 QST
      for (let i = 0; i < 5; i++) {
        await mockQst.mintTokens("2000000000000000000", { from: erin });
      }

      // Erin approves QST to be spent
      await mockQst.approve(qubeProfile.address, "10000000000000000000", {
        from: erin,
      });

      // Alice makes the team not joinable
      await qubeProfile.makeTeamNotJoinable("1", {
        from: alice,
      });

      // It stays the same if a team is not joinable
      assert.equal(await qubeProfile.numberTeams(), "1");

      // Verify the team profile data is accurate
      result = await qubeProfile.getTeamProfile("1");
      assert.equal(result[4], false); // Team is not joinable

      await expectRevert(
        qubeProfile.createProfile("1", mockBunnies.address, "3", {
          from: erin,
        }),
        "Team not joinable"
      );

      await expectRevert(qubeProfile.makeTeamNotJoinable("0", { from: alice }), "teamId invalid");

      await expectRevert(qubeProfile.makeTeamNotJoinable("4", { from: alice }), "teamId invalid");
    });

    it("Function to make a team joinable works", async () => {
      await qubeProfile.makeTeamJoinable("1", {
        from: alice,
      });

      await expectRevert(qubeProfile.makeTeamJoinable("0", { from: alice }), "teamId invalid");

      await expectRevert(qubeProfile.makeTeamJoinable("4", { from: alice }), "teamId invalid");

      // It stays the same if a team is not joinable
      assert.equal(await qubeProfile.numberTeams(), "1");

      // Verify the team profile data is accurate
      result = await qubeProfile.getTeamProfile("1");
      assert.equal(result[4], true); // Team is not joinable

      // Erin creates her profile
      await qubeProfile.createProfile("1", mockBunnies.address, "3", {
        from: erin,
      });
    });

    it("Function to remove a NFT address works and does not prevent pausing profiles", async () => {
      result = await qubeProfile.revokeRole(NFT_ROLE, mockBunnies.address, {
        from: alice,
      });

      expectEvent(result, "RoleRevoked", {
        role: NFT_ROLE,
        account: mockBunnies.address,
        sender: alice,
      });

      assert.equal(await qubeProfile.getRoleMemberCount(NFT_ROLE), "0");

      result = await qubeProfile.pauseProfile({ from: david });

      expectEvent(result, "UserPause", {
        userAddress: david,
        teamId: "1",
      });
    });

    it("Function to add a team works", async () => {
      await expectRevert(qubeProfile.addTeam("BOB", { from: alice }), "Must be > 3");

      await expectRevert(qubeProfile.addTeam("ABCDEFGHIJKLMNOPQRST", { from: alice }), "Must be < 20");

      result = await qubeProfile.addTeam("The Admins", "ipfs://hash/team2.json", {
        from: alice,
      });

      assert.equal(await qubeProfile.numberTeams(), "2");

      // Verify the team profile data is accurate
      result = await qubeProfile.getTeamProfile("2");
      assert.equal(result[0], "The Admins");
      assert.equal(result[1], "ipfs://hash/team2.json");
    });

    it("Function to claim fees work", async () => {
      result = await mockQst.balanceOf(qubeProfile.address);
      await qubeProfile.claimFee(result, {
        from: alice,
      });

      result = await mockQst.balanceOf(alice);

      assert.equal(result.toString(), "75000000000000000000");
    });

    it("Functions to change fees work", async () => {
      // 5 QST
      assert.equal(await qubeProfile.numberQstToRegister(), "5000000000000000000");

      // Set to 1/4/2 QST
      await qubeProfile.updateNumberQst("1000000000000000000", "4000000000000000000", "2000000000000000000", {
        from: alice,
      });

      result = await qubeProfile.numberQstToReactivate();

      // 1 QST
      assert.equal(result.toString(), "1000000000000000000");

      result = await qubeProfile.numberQstToRegister();

      // 4 QST
      assert.equal(result.toString(), "4000000000000000000");

      result = await qubeProfile.numberQstToUpdate();

      // 2 QST
      assert.equal(await qubeProfile.numberQstToUpdate(), "2000000000000000000");
    });

    it("Only ERC721 contracts can be added", async () => {
      // Alice cannot add a user
      await expectRevert(
        qubeProfile.addNftAddress(bob, {
          from: alice,
        }),
        "function call to a non-contract account"
      );

      // Alice cannot add a contract that doesn't support the interface
      await expectRevert(
        qubeProfile.addNftAddress(mockAdmin.address, {
          from: alice,
        }),
        "function selector was not recognized and there's no fallback function"
      );

      // Bob deploys MockCats
      mockCats = await MockCats.new({ from: bob });

      // Alice can add a new NFT contract deployed by Bob
      result = await qubeProfile.addNftAddress(mockCats.address, {
        from: alice,
      });

      expectEvent(result, "RoleGranted", {
        role: NFT_ROLE,
        account: mockCats.address,
        sender: alice,
      });

      assert.equal(await qubeProfile.getRoleMemberCount(NFT_ROLE), "1");
    });

    it("Exceptions for out-of-gas loops for points work", async () => {
      // Initialize an array with 1000 entries that are bob's address
      var _usersLoop = [];
      for (let i = 0; i < 1000; i++) {
        _usersLoop.push(bob);
      }

      // Verify array length is 1000
      assert.equal(_usersLoop.length, 1000);

      // Frank has point role and increases Bob's point 1000 times
      result = await qubeProfile.increaseUserPointsMultiple(_usersLoop, "1", "1011111111", {
        from: frank,
      });

      // Verify events
      expectEvent.inTransaction(result.receipt.transactionHash, qubeProfile, "UserPointIncreaseMultiple", {
        userAddresses: _usersLoop,
        numberPoints: "1",
        campaignId: "1011111111",
      });

      // Check it was updated properly
      result = await qubeProfile.getUserProfile(bob);
      assert.equal(result[1], "1178");

      // Frank has made a mistake and corrects it
      result = await qubeProfile.removeUserPointsMultiple(_usersLoop, "1", {
        from: frank,
      });

      // Check it was updated properly
      result = await qubeProfile.getUserProfile(bob);
      assert.equal(result[1], "178");

      // Make the array length equal to 1001
      _usersLoop.push(bob);
      assert.equal(_usersLoop.length, 1001);

      // Array length is too long
      await expectRevert(
        qubeProfile.increaseUserPointsMultiple(_usersLoop, "1", "1011111111", {
          from: frank,
        }),
        "Length must be < 1001"
      );

      // Array length is too long
      await expectRevert(
        qubeProfile.removeUserPointsMultiple(_usersLoop, "1", {
          from: frank,
        }),
        "Length must be < 1001"
      );
    });

    describe("Special functions", async () => {
      it("Change team is only callable by special role", async () => {
        assert.equal(await qubeProfile.getRoleMemberCount(SPECIAL_ROLE), "0");
        // changeTeam
        await expectRevert(
          qubeProfile.changeTeam(bob, "1", {
            from: alice,
          }),
          "Not a special admin"
        );
      });

      it("Frank is added as a special admin", async () => {
        result = await qubeProfile.grantRole(SPECIAL_ROLE, frank, {
          from: alice,
        });

        expectEvent(result, "RoleGranted", {
          role: SPECIAL_ROLE,
          account: frank,
          sender: alice,
        });

        assert.equal(await qubeProfile.getRoleMemberCount(SPECIAL_ROLE), "1");
      });

      it("Frank can change team for user", async () => {
        result = await qubeProfile.getTeamProfile("1");
        assert.equal(result[2].toString(), "3");

        result = await qubeProfile.getTeamProfile("2");
        assert.equal(result[2].toString(), "0");

        result = await qubeProfile.changeTeam(bob, "2", {
          from: frank,
        });

        expectEvent(result, "UserChangeTeam", {
          userAddress: bob,
          oldTeamId: "1",
          newTeamId: "2",
        });

        result = await qubeProfile.getTeamProfile("1");
        assert.equal(result[2].toString(), "2");

        result = await qubeProfile.getTeamProfile("2");
        assert.equal(result[2].toString(), "1");
      });

      it("Exceptions for changeTeam are properly triggered", async () => {
        await expectRevert(
          qubeProfile.changeTeam(frank, "1", {
            from: frank,
          }),
          "User doesn't exist"
        );

        await expectRevert(
          qubeProfile.changeTeam(carol, "5", {
            from: frank,
          }),
          "teamId doesn't exist"
        );

        await expectRevert(
          qubeProfile.changeTeam(bob, "2", {
            from: frank,
          }),
          "Already in the team"
        );

        // Alice makes the team not joinable
        await qubeProfile.makeTeamNotJoinable("2", {
          from: alice,
        });

        // Frnak cannot change Carol to team2 since team is not joinable
        await expectRevert(
          qubeProfile.changeTeam(carol, "2", {
            from: frank,
          }),
          "Team not joinable"
        );
      });
    });
  });
});
