const C = require('../constants');
const { deploy } = require('../fixtures');
const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

const revokeTests = () => {
  let deployed, admin, a, b, c, d, token, vesting, batch, lock, recipient;
  let amount, vestingPlan, lockPlan;
  it('creates a vesting plan with lockup, and then revokes the plan before it has started to vest', async () => {
    deployed = await deploy(18);
    admin = deployed.admin;
    a = deployed.a;
    b = deployed.b;
    c = deployed.c;
    d = deployed.d;
    token = deployed.token;
    batch = deployed.batch;
    vesting = deployed.tvp;
    lock = deployed.vestingLock;
    let now = BigInt(await time.latest());
    amount = C.E18_10000;
    vestingPlan = {
      amount,
      start: now + C.DAY,
      cliff: now + C.DAY,
      rate: C.E18_100,
      period: C.WEEK,
    };
    lockPlan = {
      amount,
      start: now + C.DAY,
      cliff: now + C.DAY,
      rate: C.E18_100,
      period: C.MONTH,
    };
    recipient = {
      beneficiary: a.address,
      adminRedeem: true,
    };
    await batch.createVestingLockupPlans(
      lock.target,
      token.target,
      amount,
      [recipient],
      [vestingPlan],
      admin,
      false,
      [lockPlan],
      false,
      1
    );
    await vesting.revokePlans(['1']);
    await lock.connect(a).burnRevokedVesting('1');
    await expect(vesting.ownerOf('1')).to.be.reverted;
    await expect(lock.ownerOf('1')).to.be.reverted;
  });
  it('creates a vesting plan lockup and revokes it after starting to vest but before lockup has started', async () => {
    let now = BigInt(await time.latest());
    vestingPlan.start = now;
    vestingPlan.cliff = now;
    lockPlan.start = now + C.MONTH;
    lockPlan.cliff = now + C.MONTH;
    await batch.createVestingLockupPlans(
      lock.target,
      token.target,
      amount,
      [recipient],
      [vestingPlan],
      admin,
      false,
      [lockPlan],
      false,
      1
    );
    await time.increase(C.WEEK + C.WEEK);
    await vesting.revokePlans(['2']);
    let remainder = (await vesting.plans('2')).amount;
    await expect(lock.connect(a).burnRevokedVesting('2')).to.be.revertedWith('!revoked');
    await lock.connect(a).redeemVestingPlans(['2']);
    expect(await token.balanceOf(lock.target)).to.eq(remainder);
    let lockup = await lock.getVestingLock('2');
    expect(lockup.totalAmount).to.eq(remainder);
    expect(lockup.availableAmount).to.eq(remainder);
    let lockEnd = await lock.getLockEnd('2');
    await time.increaseTo(lockEnd);
    await lock.connect(a).redeemAndUnlock(['2']);
    expect(await token.balanceOf(lock.target)).to.eq(0);
    expect(await token.balanceOf(a.address)).to.eq(remainder);
    await token.connect(a).transfer(admin.address, remainder);
  });
  it('creates a vestinglock plan and revokes it midway through vesting and midway through lockup, where the revoke burns the vesting plan', async () => {
    let now = BigInt(await time.latest());
    vestingPlan.start = now;
    vestingPlan.cliff = now;
    lockPlan.start = now;
    lockPlan.cliff = now;
    await batch.createVestingLockupPlans(
      lock.target,
      token.target,
      amount,
      [recipient],
      [vestingPlan],
      admin,
      false,
      [lockPlan],
      false,
      1
    );
    await time.increase(C.WEEK);
    await lock.connect(a).redeemAndUnlock(['3']);
    await vesting.revokePlans(['3']);
    await expect(vesting.ownerOf('3')).to.be.reverted;
    await expect(lock.connect(a).burnRevokedVesting('3')).to.be.reverted;
    await time.increase(C.MONTH);
    await lock.connect(a).unlock(['3']);
    await lock.connect(a).burnRevokedVesting('3');
  });
  it('creates a vestinglockup plan and future revokes it after it has started vesting', async () => {
    let now = BigInt(await time.latest());
    vestingPlan.start = now;
    vestingPlan.cliff = now;
    lockPlan.start = now;
    lockPlan.cliff = now;
    await batch.createVestingLockupPlans(
      lock.target,
      token.target,
      amount,
      [recipient],
      [vestingPlan],
      admin,
      false,
      [lockPlan],
      false,
      1
    );
    await time.increase(C.WEEK);
    now = BigInt(await time.latest());
    await lock.connect(a).redeemAndUnlock(['4']);
    await vesting.futureRevokePlans(['4'], now + C.WEEK);
    await time.increase(C.MONTH);
    await lock.connect(a).redeemAndUnlock(['4']);
    await time.increase(C.MONTH);
    await lock.connect(a).unlock(['4']);
  });
};

module.exports = {
  revokeTests,
};
