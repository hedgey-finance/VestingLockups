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
  console.log(`New VestingLock Contract deployed to address: ${vestingLock.target}`);
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


const lockups = '0x1961A23409CA59EEDCA6a99c97E4087DaD752486';
const votingLockups = '0x73cD8626b3cD47B009E68380720CFE6679A3Ec3D';
const boundLockups = '0xA600EC7Db69DFCD21f19face5B209a55EAb7a7C0';
const boundVotingLockups = '0xdE8465D44eBfC761Ee3525740E06C916886E1aEB';
const vesting = '0x2CDE9919e81b20B4B33DD562a48a84b54C48F00C'
const voting = '0x1bb64AF7FE05fc69c740609267d2AbE3e119Ef82'
const uriBase = 'https://dynamic-nft.hedgey.finance/ethereum/'

deployVestingLock(vesting, voting, uriBase, [lockups, votingLockups, boundLockups, boundVotingLockups, vesting, voting]);


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