// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin-4.5.0/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin-4.5.0/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IVEQst.sol";

contract Delegator is ERC20 {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    IVEQst public immutable VEQst;

    /**
     * @notice Constructor
     * @param _VEQst: VEQst contract
     * @param _token: Qst Token contract
     */
    constructor(IVEQst _VEQst, IERC20 _token) ERC20("VEQst Delegator Token", "VDT") {
        VEQst = _VEQst;
        token = _token;
        token.safeApprove(address(_VEQst), type(uint256).max);
    }

    function createLock(uint256 _amount, uint256 _unlockTime) external {
        token.safeTransferFrom(msg.sender, address(this), _amount);
        VEQst.createLock(_amount, _unlockTime);
    }

    function withdrawAll(address _to) external {
        VEQst.withdrawAll(_to);
    }

    function earlyWithdraw(address _to, uint256 _amount) external {
        VEQst.earlyWithdraw(_to, _amount);
    }

    function increaseLockAmount(uint256 _amount) external {
        token.safeTransferFrom(msg.sender, address(this), _amount);
        VEQst.increaseLockAmount(_amount);
    }

    function increaseUnlockTime(uint256 _newUnlockTime) external {
        VEQst.increaseUnlockTime(_newUnlockTime);
    }

    function emergencyWithdraw() external {
        VEQst.emergencyWithdraw();
    }

    /// @notice Delegate in delegator smart contract.
    /// @param user The user address
    /// @param amount The delegated qst amount
    /// @param lockEndTime The lock end time in qst pool.
    function delegate(
        address user,
        uint256 amount,
        uint256 lockEndTime
    ) external {
        _mint(user, amount);
    }
}
