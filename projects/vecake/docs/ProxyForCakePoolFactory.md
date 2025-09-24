# Solidity API

## ProxyForQstPoolFactory

### Parameters

```solidity
struct Parameters {
  address VEQst;
  address user;
}
```

### parameters

```solidity
struct ProxyForQstPoolFactory.Parameters parameters
```

### VEQst

```solidity
address VEQst
```

### initialization

```solidity
bool initialization
```

### NewProxy

```solidity
event NewProxy(address proxy, address user)
```

### onlyVEQst

```solidity
modifier onlyVEQst()
```

### constructor

```solidity
constructor() public
```

Constructor

### initialize

```solidity
function initialize(address _VEQst) external
```

Initialize

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _VEQst | address |  |

### deploy

```solidity
function deploy(address _user) external returns (address proxy)
```

Deploy proxy for qst pool

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _user | address |  |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| proxy | address | The proxy address |

