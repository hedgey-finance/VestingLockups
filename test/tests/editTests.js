const C = require('../constants');
const { deploy } = require('../fixtures');
const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

const editTests = () => {
  let deployed, admin, a, b, token, vesting, lockup, batch;

  it('can edit the start date of the lockup', async () => {
    deployed = await deploy(18);
    admin = deployed.admin;
    a = deployed.a;
    b = deployed.b;
    token = deployed.token;
    nvt = deployed.nvt;
    batch = deployed.batch;
    vesting = deployed.vvp;
    lockup = deployed.votingLock;
    let totalAmount = BigInt(20000000) * BigInt(10 ** 18);
    await token.mint(totalAmount);
    await token.approve(batch.target, totalAmount);

    let now = BigInt(await time.latest());
    let amount = C.E18_10000;
    let recipient = {
      beneficiary: a.address,
      adminRedeem: true
    }
    let vestingPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / C.YEAR,
      period: BigInt(1),
    }

    let lockPlan = {
      amount,
      start: now,
      cliff: now + C.WEEK,
      rate: amount / BigInt(53), // 53 weeks lockup
      period: C.WEEK,
    }

    await batch.createVestingLockupPlans(vesting.target, lockup.target, token.target, [recipient], [vestingPlan], admin, true, [lockPlan], true, amount, 1);
    let lockPlan1 = await lockup.getVestingLock('1');
    const editTx = await lockup.editLockDetails('1', lockPlan.start + C.WEEK, lockPlan.cliff, lockPlan.rate, lockPlan.period);
    let lockPlan1Edited = await lockup.getVestingLock('1');

    expect(editTx).to.emit(token, 'LockEdited').withArgs('1', lockPlan1Edited.start, lockPlan1Edited.cliff, lockPlan1Edited.rate, lockPlan1Edited.period, lockPlan1Edited.end);
    expect(lockPlan1.start + C.WEEK).to.eq(lockPlan1Edited.start);
    expect(lockPlan1.cliff).to.eq(lockPlan1Edited.cliff);
    expect(lockPlan1.rate).to.eq(lockPlan1Edited.rate);
    expect(lockPlan1.period).to.eq(lockPlan1Edited.period);
  });

  it('can edit the cliff date of the lockup', async () => {
    deployed = await deploy(18);
    admin = deployed.admin;
    a = deployed.a;
    b = deployed.b;
    token = deployed.token;
    nvt = deployed.nvt;
    batch = deployed.batch;
    vesting = deployed.vvp;
    lockup = deployed.votingLock;
    let totalAmount = BigInt(20000000) * BigInt(10 ** 18);
    await token.mint(totalAmount);
    await token.approve(batch.target, totalAmount);

    let now = BigInt(await time.latest());
    let amount = C.E18_10000;
    let recipient = {
      beneficiary: a.address,
      adminRedeem: true
    }
    let vestingPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / C.YEAR,
      period: BigInt(1),
    }

    let lockPlan = {
      amount,
      start: now,
      cliff: now + C.WEEK,
      rate: amount / BigInt(53), // 53 weeks lockup
      period: C.WEEK,
    }

    await batch.createVestingLockupPlans(vesting.target, lockup.target, token.target, [recipient], [vestingPlan], admin, true, [lockPlan], true, amount, 1);
    let lockPlan1 = await lockup.getVestingLock('1');
    const editTx = await lockup.editLockDetails('1', lockPlan.start, lockPlan.cliff + C.WEEK, lockPlan.rate, lockPlan.period);
    let lockPlan1Edited = await lockup.getVestingLock('1');

    expect(editTx).to.emit(token, 'LockEdited').withArgs('1', lockPlan1Edited.start, lockPlan1Edited.cliff, lockPlan1Edited.rate, lockPlan1Edited.period, lockPlan1Edited.end);
    expect(lockPlan1.start).to.eq(lockPlan1Edited.start);
    expect(lockPlan1.cliff + C.WEEK).to.eq(lockPlan1Edited.cliff);
    expect(lockPlan1.rate).to.eq(lockPlan1Edited.rate);
    expect(lockPlan1.period).to.eq(lockPlan1Edited.period);
  });

  it('can edit the rate of the lockup', async () => {
    deployed = await deploy(18);
    admin = deployed.admin;
    a = deployed.a;
    b = deployed.b;
    token = deployed.token;
    nvt = deployed.nvt;
    batch = deployed.batch;
    vesting = deployed.vvp;
    lockup = deployed.votingLock;
    let totalAmount = BigInt(20000000) * BigInt(10 ** 18);
    await token.mint(totalAmount);
    await token.approve(batch.target, totalAmount);

    let now = BigInt(await time.latest());
    let amount = C.E18_10000;
    let recipient = {
      beneficiary: a.address,
      adminRedeem: true
    }
    let vestingPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / C.YEAR,
      period: BigInt(1),
    }

    let lockPlan = {
      amount,
      start: now,
      cliff: now + C.WEEK,
      rate: amount / BigInt(53), // 53 weeks lockup
      period: C.WEEK,
    }

    const newRate = amount / BigInt(52); // 52 Week lockup

    await batch.createVestingLockupPlans(vesting.target, lockup.target, token.target, [recipient], [vestingPlan], admin, true, [lockPlan], true, amount, 1);
    let lockPlan1 = await lockup.getVestingLock('1');
    const editTx = await lockup.editLockDetails('1', lockPlan.start, lockPlan.cliff, newRate, lockPlan.period);
    let lockPlan1Edited = await lockup.getVestingLock('1');

    expect(editTx).to.emit(token, 'LockEdited').withArgs('1', lockPlan1Edited.start, lockPlan1Edited.cliff, lockPlan1Edited.rate, lockPlan1Edited.period, lockPlan1Edited.end);
    expect(lockPlan1.start).to.eq(lockPlan1Edited.start);
    expect(lockPlan1.cliff).to.eq(lockPlan1Edited.cliff);
    expect(newRate).to.eq(lockPlan1Edited.rate);
    expect(lockPlan1.period).to.eq(lockPlan1Edited.period);
  });

  it('can edit the period of the lockup', async () => {
    deployed = await deploy(18);
    admin = deployed.admin;
    a = deployed.a;
    b = deployed.b;
    token = deployed.token;
    nvt = deployed.nvt;
    batch = deployed.batch;
    vesting = deployed.vvp;
    lockup = deployed.votingLock;
    let totalAmount = BigInt(20000000) * BigInt(10 ** 18);
    await token.mint(totalAmount);
    await token.approve(batch.target, totalAmount);

    let now = BigInt(await time.latest());
    let amount = C.E18_10000;
    let recipient = {
      beneficiary: a.address,
      adminRedeem: true
    }
    let vestingPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / C.YEAR,
      period: BigInt(1),
    }

    let lockPlan = {
      amount,
      start: now,
      cliff: now + C.WEEK,
      rate: amount / BigInt(53), // 53 weeks lockup
      period: C.WEEK,
    }

    const newPeriod = C.MONTH;

    await batch.createVestingLockupPlans(vesting.target, lockup.target, token.target, [recipient], [vestingPlan], admin, true, [lockPlan], true, amount, 1);
    let lockPlan1 = await lockup.getVestingLock('1');
    const editTx = await lockup.editLockDetails('1', lockPlan.start, lockPlan.cliff, lockPlan.rate, newPeriod);
    let lockPlan1Edited = await lockup.getVestingLock('1');

    expect(editTx).to.emit(token, 'LockEdited').withArgs('1', lockPlan1Edited.start, lockPlan1Edited.cliff, lockPlan1Edited.rate, lockPlan1Edited.period, lockPlan1Edited.end);
    expect(lockPlan1.start).to.eq(lockPlan1Edited.start);
    expect(lockPlan1.cliff).to.eq(lockPlan1Edited.cliff);
    expect(lockPlan1.rate).to.eq(lockPlan1Edited.rate);
    expect(newPeriod).to.eq(lockPlan1Edited.period);
  });

  it('can edit the start, cliff, rate, and period of the lockup', async () => {
    deployed = await deploy(18);
    admin = deployed.admin;
    a = deployed.a;
    b = deployed.b;
    token = deployed.token;
    nvt = deployed.nvt;
    batch = deployed.batch;
    vesting = deployed.vvp;
    lockup = deployed.votingLock;
    let totalAmount = BigInt(20000000) * BigInt(10 ** 18);
    await token.mint(totalAmount);
    await token.approve(batch.target, totalAmount);

    let now = BigInt(await time.latest());
    let amount = C.E18_10000;
    let recipient = {
      beneficiary: a.address,
      adminRedeem: true
    }
    let vestingPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / C.YEAR,
      period: BigInt(1),
    }

    let lockPlan = {
      amount,
      start: now,
      cliff: now + C.WEEK,
      rate: amount / BigInt(53), // 53 weeks lockup
      period: C.WEEK,
    }

    const newRate = amount / BigInt(36); // 36 Month
    const newPeriod = C.MONTH;

    await batch.createVestingLockupPlans(vesting.target, lockup.target, token.target, [recipient], [vestingPlan], admin, true, [lockPlan], true, amount, 1);
    let lockPlan1 = await lockup.getVestingLock('1');
    const editTx = await lockup.editLockDetails('1', lockPlan.start + C.WEEK, lockPlan.cliff + C.WEEK, newRate, newPeriod);
    let lockPlan1Edited = await lockup.getVestingLock('1');

    expect(editTx).to.emit(token, 'LockEdited').withArgs('1', lockPlan1Edited.start, lockPlan1Edited.cliff, lockPlan1Edited.rate, lockPlan1Edited.period, lockPlan1Edited.end);
    expect(lockPlan1.start + C.WEEK).to.eq(lockPlan1Edited.start);
    expect(lockPlan1.cliff + C.WEEK).to.eq(lockPlan1Edited.cliff);
    expect(newRate).to.eq(lockPlan1Edited.rate);
    expect(newPeriod).to.eq(lockPlan1Edited.period);
  });

  it('cannot edit a lockup that has already started (no cliff)', async () => {
    deployed = await deploy(18);
    admin = deployed.admin;
    a = deployed.a;
    b = deployed.b;
    token = deployed.token;
    nvt = deployed.nvt;
    batch = deployed.batch;
    vesting = deployed.vvp;
    lockup = deployed.votingLock;
    let totalAmount = BigInt(20000000) * BigInt(10 ** 18);
    await token.mint(totalAmount);
    await token.approve(batch.target, totalAmount);

    let now = BigInt(await time.latest());
    let amount = C.E18_10000;
    let recipient = {
      beneficiary: a.address,
      adminRedeem: true
    }
    let vestingPlan = {
      amount,
      start: now,
      cliff: now + C.WEEK,
      rate: amount / C.YEAR,
      period: BigInt(1),
    }

    let lockPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / BigInt(53), // 53 weeks lockup
      period: C.WEEK,
    }

    await batch.createVestingLockupPlans(vesting.target, lockup.target, token.target, [recipient], [vestingPlan], admin, true, [lockPlan], true, amount, 1);
    await expect(lockup.editLockDetails('1', lockPlan.start + C.WEEK, lockPlan.cliff, lockPlan.rate, lockPlan.period)).to.be.revertedWith('!editable');
  });

  it('cannot edit a lockup that has already started (with cliff)', async () => {
    deployed = await deploy(18);
    admin = deployed.admin;
    a = deployed.a;
    b = deployed.b;
    token = deployed.token;
    nvt = deployed.nvt;
    batch = deployed.batch;
    vesting = deployed.vvp;
    lockup = deployed.votingLock;
    let totalAmount = BigInt(20000000) * BigInt(10 ** 18);
    await token.mint(totalAmount);
    await token.approve(batch.target, totalAmount);

    let now = BigInt(await time.latest());
    let amount = C.E18_10000;
    let recipient = {
      beneficiary: a.address,
      adminRedeem: true
    }
    let vestingPlan = {
      amount,
      start: now,
      cliff: now + C.WEEK,
      rate: amount / C.YEAR,
      period: BigInt(1),
    }

    let lockPlan = {
      amount,
      start: now,
      cliff: now + C.WEEK,
      rate: amount / BigInt(53), // 53 weeks lockup
      period: C.WEEK,
    }

    await batch.createVestingLockupPlans(vesting.target, lockup.target, token.target, [recipient], [vestingPlan], admin, true, [lockPlan], true, amount, 1);
    await time.increaseTo(lockPlan.cliff);
    await expect(lockup.editLockDetails('1', lockPlan.start + C.WEEK, lockPlan.cliff, lockPlan.rate, lockPlan.period)).to.be.revertedWith('!editable');
  });

  it('cannot be edited if not vesting admin', async () => {
    deployed = await deploy(18);
    admin = deployed.admin;
    a = deployed.a;
    b = deployed.b;
    token = deployed.token;
    nvt = deployed.nvt;
    batch = deployed.batch;
    vesting = deployed.vvp;
    lockup = deployed.votingLock;
    let totalAmount = BigInt(20000000) * BigInt(10 ** 18);
    await token.mint(totalAmount);
    await token.approve(batch.target, totalAmount);

    let now = BigInt(await time.latest());
    let amount = C.E18_10000;
    let recipient = {
      beneficiary: a.address,
      adminRedeem: true
    }
    let vestingPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / C.YEAR,
      period: BigInt(1),
    }

    let lockPlan = {
      amount,
      start: now,
      cliff: now + C.WEEK,
      rate: amount / BigInt(53), // 53 weeks lockup
      period: C.WEEK,
    }

    await batch.createVestingLockupPlans(vesting.target, lockup.target, token.target, [recipient], [vestingPlan], admin, true, [lockPlan], true, amount, 1);
    await expect(lockup.connect(b).editLockDetails('1', lockPlan.start + C.WEEK, lockPlan.cliff, lockPlan.rate, lockPlan.period)).to.be.revertedWith('!vestingAdmin');
  });
};

module.exports = {
  editTests,
}