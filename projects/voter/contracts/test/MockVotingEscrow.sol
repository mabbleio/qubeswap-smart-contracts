// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "hardhat/console.sol";

contract MockVotingEscrow {
    uint256 public totalSupplySlope;
    mapping(address => int128) public userSlope;
    mapping(address => uint256) public userLockEnd;

    function createLocksForUser(
        address addr,
        int128 slope,
        uint256 end
    ) external {
        userSlope[addr] = slope;
        userLockEnd[addr] = end;
    }

    function userInfo(address user)
        external
        view
        returns (
            address, // qstPoolProxy
            uint128, // qstAmount
            uint48, // lockEndTime
            uint48, // migrationTime
            uint16, // qstPoolType
            uint16 // withdrawFlag
        )
    {
        return (address(0), 0, 0, 0, 0, 0);
    }

    function locks(address addr) external view returns (int128, uint256) {
        return (userSlope[addr], userLockEnd[addr]);
    }

    function setTotalSupply(uint256 _total) external {
        totalSupplySlope = _total;
    }

    function totalSupplyAtTime(uint256 _timestamp) external view returns (uint256) {
        return totalSupplySlope;
    }
}
