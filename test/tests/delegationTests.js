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
      amount,
      [recipient],
      [a.address],
      [vestingPlan],
      admin.address,
      false,
      [lockPlan],
      false,
      '7'
    );
    expect(tx).to.emit(lock, 'VestingLockupBatchCreated').withArgs(admin.address, token.target, 1, 1, 1, amount, '7');
    let votingVault = await vesting.votingVaults(1);
    if (params.voting) {
      expect(tx).to.emit(vesting, 'VotingVaultCreated').withArgs(1, votingVault);
      expect(await token.delegates(votingVault)).to.eq(a.address);
      expect(await token.getVotes(a.address)).to.eq(amount);
    } else {
      expect(tx).to.emit(vesting, 'TokenDelegated').withArgs(1, a.address);
      expect(await vesting.delegatedTo(1)).to.eq(a.address);
    }
    expect(await lock.delegatedTo(1)).to.eq(a.address);
    expect(await lock.delegatedBalances(a.address, token.target)).to.eq(0);
  });
  it('delegates the vesting plan', async () => {
    let tx = await lock.connect(a).delegatePlans([1], [b.address]);
    if (params.voting) {
      let votingVault = await vesting.votingVaults(1);
      expect(tx).to.emit(token, 'DelegateChanged').withArgs(votingVault, a.address, b.address);
      expect(await token.delegates(votingVault)).to.eq(b.address);
      expect(await token.getVotes(a.address)).to.eq(0);
      expect(await token.getVotes(b.address)).to.eq(amount);
    } else {
      expect(tx).to.emit(vesting, 'TokenDelegated').withArgs(1, b.address);
      expect(tx).to.emit(vesting, 'DelegateRemoved').withArgs(1, a.address);
      expect(await lock.delegatedTo(1)).to.eq(a.address);
      expect(await vesting.delegatedTo(1)).to.eq(b.address);
    }
  });
  it('delegates the lockup plan', async () => {
    if (params.voting) {
      let tx = await lock.connect(a).delegateLockPlans([1], [c.address]);
      let votingVault = await lock.votingVaults(1);
      expect(tx).to.emit(token, 'DelegateChanged').withArgs(votingVault, C.ZERO_ADDRESS, c.address);
      expect(await token.delegates(votingVault)).to.eq(c.address);
    } else {
      let tx = await lock.connect(a).delegateLockNFTs([1], [c.address]);
      expect(tx).to.emit(lock, 'TokenDelegated').withArgs(1, c.address);
      expect(tx).to.emit(lock, 'DelegateRemoved').withArgs(1, a.address);
      expect(await lock.delegatedTo(1)).to.eq(c.address);
    }
  });
  it('skips redelegation if the lock has already been delegated to the desired delegatee', async () => {
    if (params.voting) {
      let tx = await lock.connect(a).delegateLockPlans([1], [c.address]);
    }
  });
  it('approves a delegator to delegate on behalf of the beneficiary', async () => {
    let tx = await lock.connect(a).approveDelegator(b.address, 1);
    expect(tx).to.emit(lock, 'DelegatorApproved').withArgs(a.address, b.address);
    expect(await lock.getApprovedDelegator(1)).to.eq(b.address);
    await lock.connect(b).delegatePlans([1], [d.address]);
    if (params.voting) {
      let vestingVault = await vesting.votingVaults(1);
      let lockVault = await lock.votingVaults(1);
      await lock.connect(b).delegateLockPlans([1], [d.address]);
      expect(await token.delegates(vestingVault)).to.eq(d.address);
      expect(await token.delegates(lockVault)).to.eq(d.address);
    } else {
      await lock.connect(b).delegateNFTs([1], [d.address]);
      expect(await lock.delegatedTo(1)).to.eq(d.address);
      expect(await vesting.delegatedTo(1)).to.eq(d.address);
    }
  });
  it('sets a delegate operator for the wallet who then redelegates the tokens', async () => {
    await lock.connect(a).setApprovalForAllDelegation(c.address, true);
    await lock.connect(c).approveDelegator(d.address, 1);
    await lock.connect(c).delegatePlans([1], [a.address]);
    await lock.connect(d).delegatePlans([1], [b.address]);
  });
};

module.exports = {
  delegationTests,
};
