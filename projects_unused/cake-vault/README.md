# Qube Qst Vault

## Description

Qubeswap Qst Vault for the QST token from the MasterChef.

## Deployment

Verify that `config.ts` has the correct information
Uncomment private key usage lines in `hardhat.config.ts` (lines 24/25)

```
export PK=PRIVATE_KEY
yarn migrate:[network]
```

### Operation

## Compounding

To compound (claim rewards and reinvest")

```
harvest()
```

## Common Errors

Refer to `test/QstVault.test.ts`
