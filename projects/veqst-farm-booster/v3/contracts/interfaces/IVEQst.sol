// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

interface IVEQst {
    function userInfo(address user)
        external
        view
        returns (
            address qstPoolProxy, // Proxy Smart Contract for users who had locked in qst pool.
            uint128 qstAmount, //  Qst amount locked in qst pool.
            uint48 lockEndTime, // Record the lockEndTime in qst pool.
            uint48 migrationTime, // Record the migration time.
            uint16 qstPoolType, // 1: Migration, 2: Delegation.
            uint16 withdrawFlag // 0: Not withdraw, 1 : withdrew.
        );

    function isQstPoolProxy(address _user) external view returns (bool);

    /// @dev Return the max epoch of the given "_user"
    function userPointEpoch(address _user) external view returns (uint256);

    /// @dev Return the max global epoch
    function epoch() external view returns (uint256);

    /// @dev Trigger global check point
    function checkpoint() external;

    /// @notice Return the proxy balance of VEQst at a given "_blockNumber"
    /// @param _user The proxy owner address to get a balance of VEQst
    /// @param _blockNumber The speicific block number that you want to check the balance of VEQst
    function balanceOfAtForProxy(address _user, uint256 _blockNumber) external view returns (uint256);

    /// @notice Return the balance of VEQst at a given "_blockNumber"
    /// @param _user The address to get a balance of VEQst
    /// @param _blockNumber The speicific block number that you want to check the balance of VEQst
    function balanceOfAt(address _user, uint256 _blockNumber) external view returns (uint256);

    /// @notice Return the voting weight of a givne user's proxy
    /// @param _user The address of a user
    function balanceOfForProxy(address _user) external view returns (uint256);

    /// @notice Return the voting weight of a givne user
    /// @param _user The address of a user
    function balanceOf(address _user) external view returns (uint256);

    /// @notice Calculate total supply of VEQst (voting power)
    function totalSupply() external view returns (uint256);
}
