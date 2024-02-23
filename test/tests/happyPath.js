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
    lockRate = C.getRate(amount, vestingPeriod, params.lockDuration);
    lockEnd = C.planEnd(lockStart, amount, lockRate, vestingPeriod);

    const lockupPlan = {
      amount,
      start: lockStart,
      cliff: lockCliff,
      rate: lockRate,
      period: vestingPeriod,
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
    expect(lockup.period).to.eq(vestingPeriod);
    expect(lockup.vestingAdmin).to.eq(vestingAdmin);
    expect(lockup.vestingTokenId).to.eq(1);
    expect(lockup.adminTransferOBO).to.eq(true);
    expect(lockup.transferable).to.eq(true);
    expect(await lock.ownerOf(1)).to.eq(a.address);
  });
  it('redeems and unlocks the vesting and lockup plan over time', async () => {});
  it('can create a vesting plan with a single date lock', async () => {
    let now = BigInt(await time.latest());
    amount = params.amount;
    vestingStart = now + BigInt(params.start);
    vestingCliff = vestingStart + BigInt(params.cliff);
    vestingRate = C.getRate(amount, params.period, params.duration);
    vestingPeriod = BigInt(params.period);
    vestingEnd = C.planEnd(vestingStart, amount, vestingRate, vestingPeriod);
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
    lockStart = vestingCliff + C.bigMax(1000, vestingPeriod * BigInt(2));
    lockCliff = lockStart;
    lockRate = amount;
    lockEnd = C.planEnd(lockStart, amount, lockRate, 1);
    const lockupPlan = {
      amount,
      start: lockStart,
      cliff: lockCliff,
      rate: lockRate,
      period: vestingPeriod,
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
      2
    );
    const plan = await vesting.plans(2);
    expect(plan.token).to.eq(token.target);
    expect(plan.amount).to.equal(amount);
    expect(plan.start).to.equal(vestingStart);
    expect(plan.cliff).to.equal(vestingCliff);
    expect(plan.rate).to.equal(vestingRate);
    expect(plan.period).to.equal(vestingPeriod);
    expect(plan.vestingAdmin).to.equal(vestingAdmin);
    expect(plan.adminTransferOBO).to.equal(true);
    expect(await vesting.ownerOf(2)).to.equal(lock.target);
    const lockup = await lock.getVestingLock(2);
    expect(lockup.token).to.equal(token.target);
    expect(lockup.availableAmount).to.eq(0);
    expect(lockup.totalAmount).to.eq(amount);
    expect(lockup.start).to.eq(lockStart);
    expect(lockup.cliff).to.eq(lockCliff);
    expect(lockup.rate).to.eq(lockRate);
    expect(lockup.period).to.eq(1);
    expect(lockup.vestingAdmin).to.eq(vestingAdmin);
    expect(lockup.vestingTokenId).to.eq(2);
    expect(lockup.adminTransferOBO).to.eq(true);
    expect(lockup.transferable).to.eq(true);
    expect(await lock.ownerOf(2)).to.eq(a.address);
  });
  it('redeems and unlocks the single date lockup plan over time', async () => {
    // move time forward to pre unlock date and check the vesting balance
    await time.increaseTo(vestingCliff + C.bigMax(100, vestingPeriod * BigInt(10)));
    // stil pre lock
    await expect(lock.connect(a).redeemAndUnlock(['2'])).to.be.revertedWith('no_unlocked_balance');
    await expect(lock.connect(a).unlock(['2'])).to.be.revertedWith('no_unlocked_balance');
    let now = BigInt(await time.latest());
    let vestingBalance = await vesting.planBalanceOf('2', now + BigInt(1), now + BigInt(1));
    console.log(`vesting balance: ${vestingBalance}`);
    let preBalance = await token.balanceOf(lock.target);
    let tx = await lock.connect(a).redeemVestingPlans(['2']);
    let postBalance = await token.balanceOf(lock.target);
    expect(postBalance - preBalance).to.eq(vestingBalance.balance);
    console.log(`token balancein lockup: ${await token.balanceOf(lock.target)}`);
    await expect(lock.connect(a).unlock(['2'])).to.be.revertedWith('no_unlocked_balance');
    await time.increaseTo(lockCliff);
    tx = await lock.connect(a).unlock(['2']);
    expect(await token.balanceOf(a.address)).to.eq(vestingBalance.balance);
    vestingBalance = await vesting.planBalanceOf('2', now + BigInt(1), now + BigInt(1));
    tx = await lock.connect(a).redeemAndUnlock(['2']);
    expect(tx).to.emit(token, 'Transfer').withArgs(vesting.target, lock.target, vestingBalance.balance);
    expect(tx).to.emit(token, 'Transfer').withArgs(lock.target, a.address, vestingBalance.balance);
  });
};
