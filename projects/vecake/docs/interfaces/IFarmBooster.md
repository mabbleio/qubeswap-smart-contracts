# Solidity API

## IFarmBooster

### depositFor

```solidity
function depositFor(address _for, uint256 _amount, uint256 _unlockTime, int128 _prevLockedAmount, uint256 _prevLockedEnd, uint256 _actionType, bool _isQstPoolUser) external
```

function to perform deposit and lock Qst for a user

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _for | address | The address to be locked and received VEQst |
| _amount | uint256 | The amount to deposit |
| _unlockTime | uint256 | New time to unlock Qst. Pass 0 if no change. |
| _prevLockedAmount | int128 | Existed locks[_for].amount |
| _prevLockedEnd | uint256 | Existed locks[_for].end |
| _actionType | uint256 | The action that user did as this internal function shared among |
| _isQstPoolUser | bool | This user is qst pool user or not several external functions |

### unlock

```solidity
function unlock(address _user, int128 _prevLockedAmount, uint256 _prevLockedEnd, uint256 _withdrawAmount) external
```

function to perform withdraw and unlock Qst for a user

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _user | address | The address to be unlocked |
| _prevLockedAmount | int128 | Existed locks[_user].amount |
| _prevLockedEnd | uint256 | Existed locks[_user].end |
| _withdrawAmount | uint256 | Qst amount |

