const C = require('../constants');
const { deploy } = require('../fixtures');
const setup = require('../fixtures');
const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');

module.exports = (params) => {
  let deployed, admin, a, b, c, d, token, nvt, vesting, batch, lock;
  let amount, vestingStart, vestingCliff, vestingRate, vestingPeriod, vestingEnd, vestingAdmin;
  let lockStart, lockCliff, lockRate, lockPeriod, lockEnd;
  it('should deploy contracts and setup an initial vesting plan with a lockup', async () => {
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
    vestingRate = C.getRate(amount, params.period, params.duration);
    vestingPeriod = BigInt(params.period);
    vestingEnd = C.planEnd(vestingStart, amount, vestingRate, vestingPeriod);
    console.log(`vestingEnd; ${vestingEnd}`);
    vestingAdmin = admin;
    const vestingPlan = {
      amount,
      start: vestingStart,
      cliff: vestingCliff,
      rate: vestingRate,
      period: vestingPeriod,
      vestingAdmin,
      adminTransferOBO: true,
    };

    lockStart = now + BigInt(params.lockStart);
    lockCliff = lockStart + BigInt(params.lockCliff);
    lockRate = C.getRate(amount, params.lockPeriod, params.lockDuration);
    lockPeriod = BigInt(params.lockPeriod);
    lockEnd = C.planEnd(lockStart, amount, lockRate, lockPeriod);
    console.log(`lockupEnd: ${lockEnd}`);

    const lockupPlan = {
      amount,
      start: lockStart,
      cliff: lockCliff,
      rate: lockRate,
      period: lockPeriod,
      vestingAdmin,
      adminTransferOBO: true,
    };
    const recipient = {
      beneficiary: a.address,
      adminRedeem: params.adminRedeem,
    };
    const tx = await batch.createVestingLockupPlans(
      vesting.target,
      lock.target,
      token.target,
      [vestingPlan],
      [recipient],
      [lockupPlan],
      [true],
      amount,
      1
    );
    const plan = await vesting.plans(1);
    expect(plan.token).to.eq(token.target);
    expect(plan.amount).to.equal(amount);
    expect(plan.start).to.equal(vestingStart);
    expect(plan.cliff).to.equal(vestingCliff);
    expect(plan.rate).to.equal(vestingRate);
    expect(plan.period).to.equal(vestingPeriod);
    expect(plan.vestingAdmin).to.equal(vestingAdmin);
    expect(plan.adminTransferOBO).to.equal(true);
    expect(await vesting.ownerOf(1)).to.equal(lock.target);
    const lockup = await lock.getVestingLock(1);
    expect(lockup.token).to.equal(token.target);
    expect(lockup.availableAmount).to.eq(0);
    expect(lockup.totalAmount).to.eq(amount);
    expect(lockup.start).to.eq(lockStart);
    expect(lockup.cliff).to.eq(lockCliff);
    expect(lockup.rate).to.eq(lockRate);
    expect(lockup.period).to.eq(lockPeriod);
    expect(lockup.vestingAdmin).to.eq(vestingAdmin);
    expect(lockup.vestingTokenId).to.eq(1);
    expect(lockup.adminTransferOBO).to.eq(true);
    expect(lockup.transferable).to.eq(true);
    expect(await lock.ownerOf(1)).to.eq(a.address);
  });
};
