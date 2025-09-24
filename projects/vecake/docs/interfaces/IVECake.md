# Solidity API

## Point

```solidity
struct Point {
  int128 bias;
  int128 slope;
  uint256 timestamp;
  uint256 blockNumber;
}
```

## IVEQst

### deposit

```solidity
function deposit(address _user, uint256 _amount, uint256 _lockDuration) external
```

_Qst pool deposit will trigger this_

### withdraw

```solidity
function withdraw(address _user) external
```

_Qst pool withdraw will trigger this_

### userPointEpoch

```solidity
function userPointEpoch(address _user) external view returns (uint256)
```

_Return the max epoch of the given "_user"_

### epoch

```solidity
function epoch() external view returns (uint256)
```

_Return the max global epoch_

### userPointHistory

```solidity
function userPointHistory(address _user, uint256 _epoch) external view returns (struct Point)
```

_Return the recorded point for _user at specific _epoch_

### pointHistory

```solidity
function pointHistory(uint256 _epoch) external view returns (struct Point)
```

_Return the recorded global point at specific _epoch_

### checkpoint

```solidity
function checkpoint() external
```

_Trigger global check point_

### balanceOfAtForProxy

```solidity
function balanceOfAtForProxy(address _user, uint256 _blockNumber) external view returns (uint256)
```

Return the proxy balance of VEQst at a given "_blockNumber"

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _user | address | The proxy owner address to get a balance of VEQst |
| _blockNumber | uint256 | The speicific block number that you want to check the balance of VEQst |

### balanceOfAt

```solidity
function balanceOfAt(address _user, uint256 _blockNumber) external view returns (uint256)
```

Return the balance of VEQst at a given "_blockNumber"

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _user | address | The address to get a balance of VEQst |
| _blockNumber | uint256 | The speicific block number that you want to check the balance of VEQst |

### balanceOfForProxy

```solidity
function balanceOfForProxy(address _user) external view returns (uint256)
```

Return the voting weight of a givne user's proxy

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _user | address | The address of a user |

### balanceOf

```solidity
function balanceOf(address _user) external view returns (uint256)
```

Return the voting weight of a givne user

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _user | address | The address of a user |

### migrateFromQstPool

```solidity
function migrateFromQstPool() external
```

Migrate from qst pool.

### delegateFromQstPool

```solidity
function delegateFromQstPool(address _delegator) external
```

Delegate from qst pool.

_this function will call one function in delegator smart contract, like this: DelegatorSC.delegate(address user, uint256 amount, uint256 endTime)._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _delegator | address | delegator address |

### createLock

```solidity
function createLock(uint256 _amount, uint256 _unlockTime) external
```

Create a new lock.

_This will crate a new lock and deposit Qst to VEQst Vault_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 | the amount that user wishes to deposit |
| _unlockTime | uint256 | the timestamp when Qst get unlocked, it will be floored down to whole weeks |

### createLockForProxy

```solidity
function createLockForProxy(uint256 _amount, uint256 _unlockTime) external
```

### increaseLockAmount

```solidity
function increaseLockAmount(uint256 _amount) external
```

Increase lock amount without increase "end"

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 | The amount of Qst to be added to the lock |

### increaseUnlockTime

```solidity
function increaseUnlockTime(uint256 _newUnlockTime) external
```

Increase unlock time without changing locked amount

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _newUnlockTime | uint256 | The new unlock time to be updated |

### withdrawAll

```solidity
function withdrawAll(address _to) external
```

Withdraw all Qst when lock has expired

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _to | address | The address which will receive the qst |

### earlyWithdraw

```solidity
function earlyWithdraw(address _to, uint256 _amount) external
```

Early withdraw Qst with penalty.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _to | address | The address which will receive the qst |
| _amount | uint256 | Qst amount |

### emergencyWithdraw

```solidity
function emergencyWithdraw() external
```

Emergency withdraw Qst.

_Under any circumstances, it is guaranteed that the user’s assets will not be locked_

