// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;
import "@openzeppelin-4.5.0/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IQubeStableSwapInfo.sol";
import "../interfaces/IQubeStableSwap.sol";

contract QubeStableSwapInfo {
    IQubeStableSwapInfo public immutable twoPoolInfo;
    IQubeStableSwapInfo public immutable threePoolInfo;

    constructor(IQubeStableSwapInfo _twoPoolInfo, IQubeStableSwapInfo _threePoolInfo) {
        twoPoolInfo = _twoPoolInfo;
        threePoolInfo = _threePoolInfo;
    }

    function get_dx(
        address _swap,
        uint256 i,
        uint256 j,
        uint256 dy,
        uint256 max_dx
    ) external view returns (uint256 dx) {
        uint256 N_COINS = IQubeStableSwap(_swap).N_COINS();
        if (N_COINS == 2) {
            dx = twoPoolInfo.get_dx(_swap, i, j, dy, max_dx);
        } else if (N_COINS == 3) {
            dx = threePoolInfo.get_dx(_swap, i, j, dy, max_dx);
        }
    }
}
