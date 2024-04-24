const { ethers } = require('hardhat');
const C = require('./constants');

const deploy = async (decimals) => {
    const [admin, a, b, c, d] = await ethers.getSigners();
    const Token = await ethers.getContractFactory('Token');
    const NVToken = await ethers.getContractFactory('NonVotingToken');
    const TokenVestingPlans = await ethers.getContractFactory('TokenVestingPlans');
    const VotingTokenVestingPlans = await ethers.getContractFactory('VotingTokenVestingPlans');
    const BatchCreator = await ethers.getContractFactory('BatchCreator');
    const TokenVestingLock = await ethers.getContractFactory('TokenVestingLock');
    const TokenLockupPlans = await ethers.getContractFactory('TokenLockupPlans');
    const VotingTokenLockupPlans = await ethers.getContractFactory('VotingTokenLockupPlans');

    const token = await Token.deploy('Token', 'TK', C.E18_1000000, decimals);
    await token.waitForDeployment();
    const nvt = await NVToken.deploy('NonVotingToken', 'NVT', C.E18_1000000, decimals);
    await nvt.waitForDeployment();
    const tvp = await TokenVestingPlans.deploy('TVP', 'TVP');
    await tvp.waitForDeployment();
    const vvp = await VotingTokenVestingPlans.deploy('VVP', 'VVP');
    await vvp.waitForDeployment();
    const batch = await BatchCreator.deploy();
    await batch.waitForDeployment();
    const vestingLock = await TokenVestingLock.deploy('VestingLock', 'VL', tvp.target, batch.target, admin.address);
    const votingLock = await TokenVestingLock.deploy('VotingLock', 'VL', vvp.target, batch.target, admin.address);
    await vestingLock.waitForDeployment();
    await votingLock.waitForDeployment();
    const tokenLockup = await TokenLockupPlans.deploy('TokenLockup', 'TL');
    const votingLockup = await VotingTokenLockupPlans.deploy('VotingLockup', 'VL');
    await token.approve(batch.target, C.E18_1000000);
    await nvt.approve(batch.target, C.E18_1000000);
    await batch.initWhiteList([vestingLock.target, votingLock.target, tvp.target, vvp.target, tokenLockup.target, votingLockup.target]);
    return {
        admin,
        a,
        b,
        c,
        d,
        token,
        nvt,
        tvp,
        vvp,
        batch,
        vestingLock,
        votingLock,
        tokenLockup,
        votingLockup,
    }
}


module.exports = {
    deploy,
}
