# Vesting Lock Contract

The Vesting Lock smart contract is a module that overlays in addition to the core hedgey Vesting Plans contracts, adding additional functionality.  
The additional functionality is the ability to layer on a lockup schedule to a vesting plan. The purpose of this is that a vesting plan may have a more restrictive lockup schedule based on token sales and other legal requirements, whereby even when tokens are vested they are still subject to an additiona lockup period. This module adds that functionality. 

The purpose is to still allow the core vesting functionality to exist, but where the Vesting Lock contract can redeem vested tokens into it, and then as those tokens unlock, the beneficiary can unlock the vested and unlocked tokens.  

There are two core ways to create a vesting plan with an additional lockup;   
1. The vesting admin can use our BatchCreator contract to simultaneously create a new vesting plan and immediately add the lockup layer ontop, where the beneficiary receives their combined vestingLock plan NFT in the single transaction.  
2. Alternativley, for vesting plans that have been already created, a vesting admin can transfer the plans into the correct vesting lock contract, and then call the create function individually to add the lockup schedule onto the existing vesting plans. 


Refernce the existing code base of Hedgey at 'https://github.com/hedgey-finance/Locked_VestingTokenPlans' for details on the Vesting contracts. 

## Testing

Clone repistory

``` bash
npm install
npx hardhat compile
npx hardhat test
```

## Deployment
To deploy the VestingLock contracts and BatchCreator, create a .env file in the main directory with your private key(s), network RPCs and etherscan API keys. Update the ./scripts/deploy.js file with the information required by the constructor arguments (name and symbol, exsting vesting plan contract addresses), and then you can use hardhat to deploy and verify the contract using the command: 

``` bash
npx hardhat run scripts/deploy.js --network <network-name>
```

## Testnet Deployments

TokenVestingLock (attached to vesting contract `0x68b6986416c7A38F630cBc644a2833A0b78b3631`): `0x5FAd0089966172959Ae4f6A42C7dF1Dcf67Efee7`    
TokenVestingLock (attached to vesting contract w/onchain voting: `0x8345Cfc7eB639a9178FA9e5FfdeBB62CCF5846A3`): `0x6aa30f9Fd88Bd079d4E76F6F379aB2fE472fDb91`     
BatchCreator Contract deployed to: `0xDf69982cEB2bd36058a1635b98f61d88d52501f5`   


## Mainnet Deployments