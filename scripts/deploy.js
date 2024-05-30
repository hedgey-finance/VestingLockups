const { ethers, run } = require('hardhat');
const { setTimeout } = require('timers/promises');

async function deployVestingLock(vestingAddress, votingVestingAddress, uriBase, contractAddresses) {
  const wallet = (await ethers.getSigners())[0].address;
  const manager = wallet;
  const TokenVestingLock = await ethers.getContractFactory('TokenVestingLock');
  const BatchCreator = await ethers.getContractFactory('BatchCreator');
  const batch = await BatchCreator.deploy();
  await batch.waitForDeployment();
  const vestingLock = await TokenVestingLock.deploy('VestingLockup', 'VL', vestingAddress, batch.target, manager);
  const votingLock = await TokenVestingLock.deploy('VotingVestingLockup', 'VVL', votingVestingAddress, batch.target, manager);
  await vestingLock.waitForDeployment();
  await votingLock.waitForDeployment();
  console.log(`New VotingLock Contract deployed to address: ${vestingLock.target}`);
  console.log(`New Voting VestingLock Contract deployed to address: ${votingLock.target}`);
  console.log(`New Batch Creator Contract deployed to address: ${batch.target}`);
  let uri = `${uriBase}${vestingLock.target.toLowerCase()}/`;
  let vUri = `${uriBase}${votingLock.target.toLowerCase()}/`;
  await vestingLock.updateBaseURI(uri);
  await votingLock.updateBaseURI(vUri);
  contractAddresses.push(vestingLock.target, votingLock.target);
  await batch.initWhiteList(contractAddresses);
  await setTimeout(10000);
  await run('verify:verify', {
    address: batch.target,
  });
  await run('verify:verify', {
    address: vestingLock.target,
    constructorArguments: ['VestingLockup', 'VL', vestingAddress, batch.target, manager],
  });
}


const lockups = '0xb49d0CD3D5290adb4aF1eBA7A6B90CdE8B9265ff';
const votingLockups = '0xB82b292C9e33154636fe8839fDb6d4081Da5c359';
const boundLockups = '0xD7E7ba882a4533eC8C8C9fB933703a42627D4deA';
const boundVotingLockups = '0x2cE4DC254a4B48824e084791147Ff7220F1A08a7';
const vesting = '0x68b6986416c7A38F630cBc644a2833A0b78b3631'
const voting = '0x8345Cfc7eB639a9178FA9e5FfdeBB62CCF5846A3'
const uriBase = 'https://dynamic-nft.hedgey.finance/sepolia/'

// deployVestingLock(vesting, voting, uriBase, [lockups, votingLockups, boundLockups, boundVotingLockups, vesting, voting]);


async function deployToken(args) {
  const Token = await ethers.getContractFactory('Token');
  const token = await Token.deploy(...args);
  await token.waitForDeployment();
  console.log(`New Token Contract deployed to address: ${token.target}`);
  await setTimeout(10000);
  await run('verify:verify', {
    address: token.target,
    constructorArguments: args,
  });
}

const name = 'BlueSkyToken';
const symbol = 'BST';
const supply = '1000000000000000000000000000';
const decimals = '18'

// deployToken([name, symbol, supply, decimals])