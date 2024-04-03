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
      adminRedeem: true,
    };
    let vestingPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / C.YEAR,
      period: BigInt(1),
    };

    let lockPlan = {
      amount,
      start: now,
      cliff: now + C.WEEK,
      rate: amount / BigInt(53), // 53 weeks lockup
      period: C.WEEK,
    };

    await batch.createVestingLockupPlans(
      lockup.target,
      token.target,
      [recipient],
      [vestingPlan],
      admin,
      true,
      [lockPlan],
      true,
      amount,
      1
    );
    let lockPlan1 = await lockup.getVestingLock('1');
    const editTx = await lockup.editLockDetails(
      '1',
      lockPlan.start + C.WEEK,
      lockPlan.cliff,
      lockPlan.rate,
      lockPlan.period
    );
    let lockPlan1Edited = await lockup.getVestingLock('1');

    expect(editTx)
      .to.emit(token, 'LockEdited')
      .withArgs(
        '1',
        lockPlan1Edited.start,
        lockPlan1Edited.cliff,
        lockPlan1Edited.rate,
        lockPlan1Edited.period,
        lockPlan1Edited.end
      );
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
      adminRedeem: true,
    };
    let vestingPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / C.YEAR,
      period: BigInt(1),
    };

    let lockPlan = {
      amount,
      start: now,
      cliff: now + C.WEEK,
      rate: amount / BigInt(53), // 53 weeks lockup
      period: C.WEEK,
    };

    await batch.createVestingLockupPlans(
      lockup.target,
      token.target,
      [recipient],
      [vestingPlan],
      admin,
      true,
      [lockPlan],
      true,
      amount,
      1
    );
    let lockPlan1 = await lockup.getVestingLock('1');
    const editTx = await lockup.editLockDetails(
      '1',
      lockPlan.start,
      lockPlan.cliff + C.WEEK,
      lockPlan.rate,
      lockPlan.period
    );
    let lockPlan1Edited = await lockup.getVestingLock('1');

    expect(editTx)
      .to.emit(token, 'LockEdited')
      .withArgs(
        '1',
        lockPlan1Edited.start,
        lockPlan1Edited.cliff,
        lockPlan1Edited.rate,
        lockPlan1Edited.period,
        lockPlan1Edited.end
      );
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
      adminRedeem: true,
    };
    let vestingPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / C.YEAR,
      period: BigInt(1),
    };

    let lockPlan = {
      amount,
      start: now,
      cliff: now + C.WEEK,
      rate: amount / BigInt(53), // 53 weeks lockup
      period: C.WEEK,
    };

    const newRate = amount / BigInt(52); // 52 Week lockup

    await batch.createVestingLockupPlans(
      lockup.target,
      token.target,
      [recipient],
      [vestingPlan],
      admin,
      true,
      [lockPlan],
      true,
      amount,
      1
    );
    let lockPlan1 = await lockup.getVestingLock('1');
    const editTx = await lockup.editLockDetails('1', lockPlan.start, lockPlan.cliff, newRate, lockPlan.period);
    let lockPlan1Edited = await lockup.getVestingLock('1');

    expect(editTx)
      .to.emit(token, 'LockEdited')
      .withArgs(
        '1',
        lockPlan1Edited.start,
        lockPlan1Edited.cliff,
        lockPlan1Edited.rate,
        lockPlan1Edited.period,
        lockPlan1Edited.end
      );
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
      adminRedeem: true,
    };
    let vestingPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / C.YEAR,
      period: BigInt(1),
    };

    let lockPlan = {
      amount,
      start: now,
      cliff: now + C.WEEK,
      rate: amount / BigInt(53), // 53 weeks lockup
      period: C.WEEK,
    };

    const newPeriod = C.MONTH;

    await batch.createVestingLockupPlans(
      lockup.target,
      token.target,
      [recipient],
      [vestingPlan],
      admin,
      true,
      [lockPlan],
      true,
      amount,
      1
    );
    let lockPlan1 = await lockup.getVestingLock('1');
    const editTx = await lockup.editLockDetails('1', lockPlan.start, lockPlan.cliff, lockPlan.rate, newPeriod);
    let lockPlan1Edited = await lockup.getVestingLock('1');

    expect(editTx)
      .to.emit(token, 'LockEdited')
      .withArgs(
        '1',
        lockPlan1Edited.start,
        lockPlan1Edited.cliff,
        lockPlan1Edited.rate,
        lockPlan1Edited.period,
        lockPlan1Edited.end
      );
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
      adminRedeem: true,
    };
    let vestingPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / C.YEAR,
      period: BigInt(1),
    };

    let lockPlan = {
      amount,
      start: now,
      cliff: now + C.WEEK,
      rate: amount / BigInt(53), // 53 weeks lockup
      period: C.WEEK,
    };

    const newRate = amount / BigInt(36); // 36 Month
    const newPeriod = C.MONTH;

    await batch.createVestingLockupPlans(
      lockup.target,
      token.target,
      [recipient],
      [vestingPlan],
      admin,
      true,
      [lockPlan],
      true,
      amount,
      1
    );
    let lockPlan1 = await lockup.getVestingLock('1');
    const editTx = await lockup.editLockDetails(
      '1',
      lockPlan.start + C.WEEK,
      lockPlan.cliff + C.WEEK,
      newRate,
      newPeriod
    );
    let lockPlan1Edited = await lockup.getVestingLock('1');

    expect(editTx)
      .to.emit(token, 'LockEdited')
      .withArgs(
        '1',
        lockPlan1Edited.start,
        lockPlan1Edited.cliff,
        lockPlan1Edited.rate,
        lockPlan1Edited.period,
        lockPlan1Edited.end
      );
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
      adminRedeem: true,
    };
    let vestingPlan = {
      amount,
      start: now,
      cliff: now + C.WEEK,
      rate: amount / C.YEAR,
      period: BigInt(1),
    };

    let lockPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / BigInt(53), // 53 weeks lockup
      period: C.WEEK,
    };

    await batch.createVestingLockupPlans(
      lockup.target,
      token.target,
      [recipient],
      [vestingPlan],
      admin,
      true,
      [lockPlan],
      true,
      amount,
      1
    );
    await expect(
      lockup.editLockDetails('1', lockPlan.start + C.WEEK, lockPlan.cliff, lockPlan.rate, lockPlan.period)
    ).to.be.revertedWith('!editable');
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
      adminRedeem: true,
    };
    let vestingPlan = {
      amount,
      start: now,
      cliff: now + C.WEEK,
      rate: amount / C.YEAR,
      period: BigInt(1),
    };

    let lockPlan = {
      amount,
      start: now,
      cliff: now + C.WEEK,
      rate: amount / BigInt(53), // 53 weeks lockup
      period: C.WEEK,
    };

    await batch.createVestingLockupPlans(
      lockup.target,
      token.target,
      [recipient],
      [vestingPlan],
      admin,
      true,
      [lockPlan],
      true,
      amount,
      1
    );
    await time.increaseTo(lockPlan.cliff);
    await expect(
      lockup.editLockDetails('1', lockPlan.start + C.WEEK, lockPlan.cliff, lockPlan.rate, lockPlan.period)
    ).to.be.revertedWith('!editable');
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
      adminRedeem: true,
    };
    let vestingPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / C.YEAR,
      period: BigInt(1),
    };

    let lockPlan = {
      amount,
      start: now,
      cliff: now + C.WEEK,
      rate: amount / BigInt(53), // 53 weeks lockup
      period: C.WEEK,
    };

    await batch.createVestingLockupPlans(
      lockup.target,
      token.target,
      [recipient],
      [vestingPlan],
      admin,
      true,
      [lockPlan],
      true,
      amount,
      1
    );
    await expect(
      lockup.connect(b).editLockDetails('1', lockPlan.start + C.WEEK, lockPlan.cliff, lockPlan.rate, lockPlan.period)
    ).to.be.revertedWith('!vestingAdmin');
  });
  it('should revert if the parameters input create an end error', async () => {
    let now = BigInt(await time.latest());
    await expect(
      lockup.editLockDetails('1', now, now, C.E18_1000, C.DAY)
    ).to.be.revertedWith('end error');
  });
  it('can edit the plan to be a single unlock date', async () => {
    let now = BigInt(await time.latest());
    let tx = await lockup.editLockDetails('1', now, now, C.E18_10000, C.DAY);
    let lock = await lockup.getVestingLock('1');
    expect(lock.start).to.eq(now);
    expect(lock.cliff).to.eq(now);
    expect(lock.rate).to.eq(C.E18_10000);
    expect(lock.period).to.eq(1);
  })
  it('can be emergency edited by admin transferring out, burning the lock, and redoing the lock', async () => {
    let now = BigInt(await time.latest());
    let amount = C.E18_10000;
    let recipient = {
      beneficiary: b.address,
      adminRedeem: true,
    };
    let vestingPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / C.YEAR,
      period: BigInt(1),
    };
    let lockPlan = {
      amount,
      start: now,
      cliff: now,
      rate: amount / BigInt(60), // 60 weeks lockup
      period: C.WEEK,
    };
    await batch.createVestingLockupPlans(
      lockup.target,
      token.target,
      [recipient],
      [vestingPlan],
      admin,
      true,
      [lockPlan],
      true,
      amount,
      1
    );
    // can't edit the lockup as its already started
    await expect(
      lockup.editLockDetails('1', now, now + C.WEEK, lockPlan.rate, C.WEEK)
    ).to.be.revertedWith('!editable');
    //update transferability
    let vestingTokenId = (await lockup.getVestingLock('2')).vestingTokenId;
    await lockup.connect(b).updateVestingTransferability('2', true);
    //transfer to b
    await vesting.transferFrom(lockup.target, b.address, vestingTokenId);
    // B will burn the lockup plan
    await lockup.connect(b).burnRevokedVesting('2');
    // admin will transfer it back to lock contract
    await vesting.transferFrom(b.address, lockup.target, vestingTokenId);
    // then admin will create new lockup plan
    await lockup.createVestingLock(recipient, vestingTokenId, now, now + C.WEEK, lockPlan.rate, C.WEEK, true, true);
    let lockupInfo = await lockup.getVestingLock('3');
    expect(lockupInfo.start).to.eq(now);
    expect(lockupInfo.cliff).to.eq(now + C.WEEK);
    expect(lockupInfo.rate).to.eq(lockPlan.rate);
    expect(lockupInfo.period).to.eq(C.WEEK);
    expect(lockupInfo.vestingTokenId).to.eq(vestingTokenId);
  });
};

module.exports = {
  editTests,
};
