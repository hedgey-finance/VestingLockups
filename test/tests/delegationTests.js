const C = require('../constants');
const { deploy } = require('../fixtures');
const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

const delegationTests = (params) => {
  let deployed, admin, a, b, c, d, token, nvt, vesting, batch, lock;
  let amount, recipient, vestingPlan, vestingStart, vestingCliff, vestingRate, vestingPeriod, vestingEnd, vestingAdmin;
  let lockPlan, lockStart, lockCliff, lockRate, lockPeriod, lockEnd;
  it('creates a vesting lock plan that is pre-delegated', async () => {
    deployed = await deploy(params.decimals);
    admin = deployed.admin;
    a = deployed.a;
    b = deployed.b;
    c = deployed.c;
    d = deployed.d;
    token = deployed.token;
    nvt = deployed.nvt;
    batch = deployed.batch;
    vesting = params.voting ? deployed.vvp : deployed.tvp;
    lock = params.voting ? deployed.votingLock : deployed.vestingLock;
    let now = BigInt(await time.latest());
    amount = params.amount;
    vestingStart = now + BigInt(params.start);
    vestingCliff = vestingStart + BigInt(params.cliff);
    vestingRate = C.getRate(amount, params.vestingPeriod, params.duration);
    vestingPeriod = BigInt(params.vestingPeriod);
    vestingEnd = C.planEnd(vestingStart, amount, vestingRate, vestingPeriod);
    vestingAdmin = admin.address;
    vestingPlan = {
      amount,
      start: vestingStart,
      cliff: vestingCliff,
      rate: vestingRate,
      period: vestingPeriod,
    };

    lockStart = now + BigInt(params.lockStart);
    lockCliff = now + BigInt(params.lockCliff);
    lockRate = C.getRate(amount, params.lockPeriod, params.lockDuration);
    lockPeriod = BigInt(params.lockPeriod);
    lockEnd = C.planEnd(lockStart, amount, lockRate, lockPeriod);

    lockPlan = {
      amount,
      start: lockStart,
      cliff: lockCliff,
      rate: lockRate,
      period: lockPeriod,
    };
    recipient = {
      beneficiary: a.address,
      adminRedeem: params.adminRedeem,
    };
    let tx = await batch.createVestingLockupPlansWithDelegation(
      lock.target,
      token.target,
      [recipient],
      [a.address],
      [vestingPlan],
      admin.address,
      false,
      [lockPlan],
      false,
      amount,
      '7'
    )
    expect(tx).to.emit(lock, 'VestingLockupBatchCreated').withArgs(admin.address, token.target, 1, 1, 1, amount, '7');
    let votingVault = await vesting.votingVaults(1);
    if (params.voting) {
      expect(tx).to.emit(vesting, 'VotingVaultCreated').withArgs(1, votingVault);
      expect(await token.getVotes(a.address)).to.eq(amount);
    }
    else {
      expect(tx).to.emit(vesting, 'TokenDelegated').withArgs(1, a.address);
      expect(await vesting.delegatedTo(1)).to.eq(a.address);
    }
    expect(await lock.delegatedTo(1)).to.eq(a.address);
    expect(await lock.delegatedBalances(a.address, token.target)).to.eq(0);
  });
  it('re-delegates the plan to another wallet', async () => {

  });
  it('approves a delegator to delegate on behalf of the beneficiary', async () => {});
  it('sets a delegate operator for the wallet who then redelegates the tokens', async () => {});
  it('tests redemption, unlock, and unlock and redeem', async () => {});
};

module.exports = {
  delegationTests,
};
