const { ethers, run } = require('hardhat');
const { setTimeout } = require('timers/promises');

async function deployVestingLock(vestingAddress, votingVestingAddress, uriBase) {
  const TokenVestingLock = await ethers.getContractFactory('TokenVestingLock');
  const BatchCreator = await ethers.getContractFactory('BatchCreator');
  const batch = await BatchCreator.deploy();
  await batch.waitForDeployment();
  const vestingLock = await TokenVestingLock.deploy('VestingLockup', 'VL', vestingAddress, batch.target);
  const votingLock = await TokenVestingLock.deploy('VotingVestingLockup', 'VVL', votingVestingAddress, batch.target);
  await vestingLock.waitForDeployment();
  await votingLock.waitForDeployment();

  console.log(`New VotingLock Contract deployed to address: ${vestingLock.target}`);
  console.log(`New Voting VestingLock Contract deployed to address: ${votingLock.target}`);
  console.log(`New Batch Creator Contract deployed to address: ${batch.target}`);

  let uri = `${uriBase}${vestingLock.target.toLowerCase()}/`;
  let vUri = `${uriBase}${votingLock.target.toLowerCase()}/`;
  await vestingLock.updateBaseURI(uri);
  await votingLock.updateBaseURI(vUri);

  await setTimeout(10000);
  await run('verify:verify', {
    address: batch.target,
  });
  await run('verify:verify', {
    address: vestingLock.target,
    constructorArguments: ['VestingLockup', 'VL', vestingAddress, batch.target],
  });
}



const vesting = '0x68b6986416c7A38F630cBc644a2833A0b78b3631'
const voting = '0x8345Cfc7eB639a9178FA9e5FfdeBB62CCF5846A3'
const uriBase = 'https://dynamic-nft.hedgey.finance/sepolia/'

deployVestingLock(vesting, voting, uriBase);