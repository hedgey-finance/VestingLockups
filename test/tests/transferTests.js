const C = require('../constants');
const { deploy } = require('../fixtures');
const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

const transferTests = () => {
  let deployed, admin, a, b, c, d, token, vesting, batch, lock, recipient;
  let amount, vestingPlan, lockPlan;
  it('creates a vestinglock plan that is transferable by the beneficiary, and they can transfer it', async () => {
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
      rate: amount / C.MONTH,
      period: BigInt(1),
    };
    lockPlan = {
      amount,
      start: now + C.DAY,
      cliff: now + C.DAY,
      rate: amount / BigInt(6),
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
      true,
      [lockPlan],
      true,
      1
    );
    await lock.connect(a).transferFrom(a.address, b.address, '1');
    expect(await lock.ownerOf('1')).to.eq(b.address);
    await lock.connect(b).safeTransferFrom(b.address, c.address, '1');
    expect(await lock.ownerOf('1')).to.eq(c.address);
  });
  it('vestinglock plan that is transferable by the admin, admin can transfer', async () => {
    await lock.connect(admin).transferFrom(c.address, a.address, '1');
    expect(await lock.ownerOf('1')).to.eq(a.address);
    await lock.connect(admin).safeTransferFrom(a.address, b.address, '1');
    expect(await lock.ownerOf('1')).to.eq(b.address);
  });
  it('a vestingLock plan that is transferable by the beneficiary, an aproved spender can transfer', async () => {
    await lock.connect(b).approve(c.address, '1');
    await lock.connect(c).transferFrom(b.address, d.address, '1');
    expect(await lock.ownerOf('1')).to.eq(d.address);
    await lock.connect(d).updateAdminTransferOBO('1', false);
    await lock.connect(d).approve(admin.address, '1');
    await lock.connect(admin).safeTransferFrom(d.address, a.address, '1');
    expect(await lock.ownerOf('1')).to.eq(a.address);
    let adminApproved = await lock.getApproved('1');
    expect(adminApproved).to.eq(C.ZERO_ADDRESS);
    expect((await lock.getVestingLock(1)).adminTransferOBO).to.eq(false);
  });
  it('checks the transfer toggles', async () => {
    await expect(lock.connect(admin).transferFrom(a.address, b.address, '1')).to.be.reverted;
    await lock.connect(a).updateAdminTransferOBO('1', true);
    await lock.connect(admin).transferFrom(a.address, b.address, '1');
    expect(await lock.ownerOf('1')).to.eq(b.address);
    await lock.connect(admin).updateTransferability(['1'], false);
    await expect(lock.connect(b).transferFrom(b.address, c.address, '1')).to.be.revertedWith('!transferable');
    await lock.connect(admin).transferFrom(b.address, c.address, '1');
    expect(await lock.ownerOf('1')).to.eq(c.address);
  });
  it('the owner can make a one time allowance for the vestingAdmin to transfer the plan without adminTransferOBO', async () => {
    // owner is C address
    // c turns off adminTransferOBO
    // then approves admin for a one time transfer
    await lock.connect(c).updateAdminTransferOBO('1', false);
    await lock.connect(c).approve(admin.address, '1');
    await lock.connect(admin).safeTransferFrom(c.address, a.address, '1');
    expect(await lock.ownerOf(1)).to.eq(a.address);
    // expect that the admin cannot transfer again
    await expect(lock.connect(admin).safeTransferFrom(a.address, b.address, '1')).to.be.reverted;
  })
  it('user cant adjust the transferability of their own plan', async () => {
    await expect(lock.connect(c).updateTransferability(['1'], true)).to.be.revertedWith('!vA');
  });
  it('admin cannot update the adminTransferOBO of a plan', async () => {
    await expect(lock.connect(admin).updateAdminTransferOBO('1', false)).to.be.revertedWith('!owner');
  });
  it('vesting admin can transfer itself to a new admin', async () => {
    await lock.connect(admin).updateVestingAdmin(['1'], d.address);
    expect((await lock.getVestingLock(1)).vestingAdmin).to.eq(d.address);
    // original vesting plan is still the same vesting admin, it should be able to transfer it back
    await lock.connect(admin).updateVestingAdmin(['1'], admin.address);
    expect((await lock.getVestingLock(1)).vestingAdmin).to.eq(admin.address);
  })
};

module.exports = {
  transferTests,
};
