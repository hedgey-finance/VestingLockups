const C = require('../constants');
const { deploy } = require('../fixtures');
const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

const createTests = (params) => {
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
    vestingRate = C.getRate(amount, params.vestingPeriod, params.duration);
    vestingPeriod = BigInt(params.vestingPeriod);
    vestingEnd = C.planEnd(vestingStart, amount, vestingRate, vestingPeriod);
    vestingAdmin = admin.address;
    const vestingPlan = {
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

    const lockupPlan = {
      amount,
      start: lockStart,
      cliff: lockCliff,
      rate: lockRate,
      period: lockPeriod,
    };
    const recipient = {
      beneficiary: a.address,
      adminRedeem: params.adminRedeem,
    };
    const tx = await batch.createVestingLockupPlans(
      lock.target,
      token.target,
      amount,
      [recipient],
      [vestingPlan],
      vestingAdmin,
      false,
      [lockupPlan],
      false,
      1
    );
    expect(tx)
      .to.emit(vesting, 'PlanCreated')
      .withArgs(
        1,
        recipient.beneficiary,
        token.target,
        amount,
        vestingStart,
        vestingCliff,
        vestingRate,
        vestingPeriod,
        vestingAdmin,
        false
      );
    expect(tx).to.emit(lock, 'VestingLockupCreated').withArgs(
      1,
      1,
      recipient.beneficiary,
      {
        token: token.target,
        availableAmount: 0,
        totalAmount: amount,
        start: lockStart,
        cliff: lockCliff,
        rate: lockRate,
        period: lockPeriod,
        vestingTokenId: 1,
        vestingAdmin: vestingAdmin,
        transferable: false,
        adminTransferOBO: false,
      },
      lockEnd
    );
    expect(tx)
      .to.emit(batch, 'VestingLockupBatchCreated')
      .withArgs(admin.address, token.target, 1, [1], [1], amount, 1);
    const plan = await vesting.plans(1);
    expect(plan.token).to.eq(token.target);
    expect(plan.amount).to.equal(amount);
    expect(plan.start).to.equal(vestingStart);
    expect(plan.cliff).to.equal(vestingCliff);
    expect(plan.rate).to.equal(vestingRate);
    expect(plan.period).to.equal(vestingPeriod);
    expect(plan.vestingAdmin).to.equal(vestingAdmin);
    expect(plan.adminTransferOBO).to.equal(false);
    expect(await vesting.ownerOf(1)).to.equal(lock.target);
    expect(await vesting.planEnd(1)).to.equal(vestingEnd);
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
    expect(lockup.adminTransferOBO).to.eq(false);
    expect(lockup.transferable).to.eq(false);
    expect(await lock.ownerOf(1)).to.eq(a.address);
    expect(await lock.getLockEnd(1)).to.eq(lockEnd);
  });
  it('creates a lockup plan with a single unlock date regardless of the period input when rate equals vesting amount', async () => {
    const vestingPlan = {
      amount,
      start: vestingStart,
      cliff: vestingCliff,
      rate: vestingRate,
      period: vestingPeriod,
    };
    const lockupPlan = {
      amount,
      start: lockStart,
      cliff: lockCliff,
      rate: amount,
      period: lockPeriod,
    };
    const recipient = {
      beneficiary: a.address,
      adminRedeem: params.adminRedeem,
    };
    const tx = await batch.createVestingLockupPlans(
      lock.target,
      token.target,
      amount,
      [recipient],
      [vestingPlan],
      vestingAdmin,
      false,
      [lockupPlan],
      false,
      1
    );
    const plan = await vesting.plans(2);
    expect(plan.token).to.eq(token.target);
    expect(plan.amount).to.equal(amount);
    expect(plan.start).to.equal(vestingStart);
    expect(plan.cliff).to.equal(vestingCliff);
    expect(plan.rate).to.equal(vestingRate);
    expect(plan.period).to.equal(vestingPeriod);
    expect(plan.vestingAdmin).to.equal(vestingAdmin);
    expect(plan.adminTransferOBO).to.equal(false);
    expect(await vesting.ownerOf(2)).to.equal(lock.target);
    expect(await vesting.planEnd(2)).to.equal(vestingEnd);
    let lockup = await lock.getVestingLock(2);
    expect(lockup.token).to.equal(token.target);
    expect(lockup.availableAmount).to.eq(0);
    expect(lockup.totalAmount).to.eq(amount);
    expect(lockup.start).to.eq(lockStart);
    expect(lockup.cliff).to.eq(lockCliff);
    expect(lockup.rate).to.eq(amount);
    expect(lockup.period).to.eq(1);
    expect(lockup.vestingAdmin).to.eq(vestingAdmin);
    expect(lockup.vestingTokenId).to.eq(2);
    expect(lockup.adminTransferOBO).to.eq(false);
    expect(lockup.transferable).to.eq(false);
    expect(await lock.ownerOf(2)).to.eq(a.address);
    expect(await lock.getLockEnd(2)).to.eq(lockStart + BigInt(1));
    await time.increaseTo(lockStart + BigInt(1));
    let now = BigInt(await time.latest());
    let redeemBalance = await vesting.planBalanceOf(2, now + BigInt(1), now + BigInt(1));
    const firstRedemption = redeemBalance.balance;
    await lock.connect(a).redeemAndUnlock([2]);
    expect(await token.balanceOf(a.address)).to.eq(firstRedemption);
    lockup = await lock.getVestingLock(2);
    expect(lockup.availableAmount).to.eq(0);
    expect(lockup.totalAmount).to.eq(redeemBalance.remainder);
    await time.increase(C.WEEK);
    now = BigInt(await time.latest()) + BigInt(1);
    redeemBalance = await vesting.planBalanceOf(2, now, now);
    const secondRedemption = redeemBalance.balance;
    await lock.connect(a).redeemAndUnlock([2]);
    expect(await token.balanceOf(a.address)).to.eq(firstRedemption + secondRedemption);
    lockup = await lock.getVestingLock(2);
    expect(lockup.availableAmount).to.eq(0);
    expect(lockup.totalAmount).to.eq(redeemBalance.remainder);
    await time.increaseTo(vestingEnd);
    await lock.connect(a).redeemAndUnlock([2]);
    expect(await token.balanceOf(a.address)).to.eq(amount);
    lockup = await lock.getVestingLock(2);
    expect(lockup.availableAmount).to.eq(0);
    expect(lockup.totalAmount).to.eq(0);
    await expect(lock.ownerOf(2)).to.be.reverted;
  });
  it('creates multiple vesting plans with lockups', async () => {
    let now = BigInt(await time.latest());
    vestingStart = now + BigInt(params.start);
    vestingCliff = vestingStart + BigInt(params.cliff);
    const vestingPlan = {
      amount,
      start: vestingStart,
      cliff: vestingCliff,
      rate: vestingRate,
      period: vestingPeriod,
    };
    lockStart = now + BigInt(params.lockStart);
    lockCliff = now + BigInt(params.lockCliff);
    const lockupPlan = {
      amount,
      start: lockStart,
      cliff: lockCliff,
      rate: lockRate,
      period: lockPeriod,
    };
    recipient = {
      beneficiary: b.address,
      adminRedeem: params.adminRedeem,
    };
    let numPlans = 25;
    let vestingPlans = new Array(numPlans).fill(vestingPlan);
    let lockupPlans = new Array(numPlans).fill(lockupPlan);
    let recipients = new Array(numPlans).fill(recipient);
    let tx = await batch.createVestingLockupPlans(
      lock.target,
      token.target,
      amount * BigInt(numPlans),
      recipients,
      vestingPlans,
      vestingAdmin,
      false,
      lockupPlans,
      false,
      3
    );
  });
  it('creates a vesting plan first, then admin transfers in and adds on a lockup plan', async () => {
    let supply = await vesting.totalSupply();
    let nextTokenId = supply + BigInt(2);
    await token.approve(vesting.target, amount);
    await vesting.createPlan(
      c.address,
      token.target,
      amount,
      vestingStart,
      vestingCliff,
      vestingRate,
      vestingPeriod,
      vestingAdmin,
      true
    );
    await vesting.transferFrom(c.address, lock.target, nextTokenId);
    expect(await vesting.ownerOf(nextTokenId)).to.eq(lock.target);
    let tx = await lock.createVestingLock(
      {
        beneficiary: c.address,
        adminRedeem: true,
      },
      nextTokenId,
      lockStart,
      lockCliff,
      lockRate,
      lockPeriod,
      false,
      false
    );
    lockEnd = C.planEnd(lockStart, amount, lockRate, lockPeriod);
    expect(tx).to.emit(lock, 'VestingLockupCreated').withArgs(
      nextTokenId,
      nextTokenId,
      c.address,
      {
        token: token.target,
        totalAmount: amount,
        availableAmount: 0,
        start: lockStart,
        cliff: lockCliff,
        rate: lockRate,
        period: lockPeriod,
        vestingTokenId: nextTokenId,
        vestingAdmin: vestingAdmin,
        transferable: false,
        adminTransferOBO: false,
      },
      lockEnd
    );
    let lockInfo = await lock.getVestingLock(nextTokenId);
    expect(lockInfo.token).to.eq(token.target);
    expect(lockInfo.totalAmount).to.eq(amount);
    expect(lockInfo.availableAmount).to.eq(0);
    expect(lockInfo.start).to.eq(lockStart);
    expect(lockInfo.cliff).to.eq(lockCliff);
    expect(lockInfo.rate).to.eq(lockRate);
    expect(lockInfo.period).to.eq(lockPeriod);
    expect(lockInfo.vestingAdmin).to.eq(vestingAdmin);
    expect(lockInfo.vestingTokenId).to.eq(nextTokenId);
    expect(lockInfo.transferable).to.eq(false);
    expect(lockInfo.adminTransferOBO).to.eq(false);
  });
  it('creates vesting lockup plans with delegations', async () => {
    let now = BigInt(await time.latest());
    vestingStart = now + BigInt(params.start);
    vestingCliff = vestingStart + BigInt(params.cliff);
    const vestingPlan = {
      amount,
      start: vestingStart,
      cliff: vestingCliff,
      rate: vestingRate,
      period: vestingPeriod,
    };
    lockStart = now + BigInt(params.lockStart);
    lockCliff = now + BigInt(params.lockCliff);
    const lockupPlan = {
      amount,
      start: lockStart,
      cliff: lockCliff,
      rate: lockRate,
      period: lockPeriod,
    };
    let recipient = {
      beneficiary: b.address,
      adminRedeem: params.adminRedeem,
    };
    let delegate = c.address;
    let numPlans = 5;
    let vestingPlans = new Array(numPlans).fill(vestingPlan);
    let lockupPlans = new Array(numPlans).fill(lockupPlan);
    let recipients = new Array(numPlans).fill(recipient);
    let delegates = new Array(numPlans).fill(delegate);
    let tx = await batch.createVestingLockupPlansWithDelegation(
      lock.target,
      token.target,
      amount * BigInt(numPlans),
      recipients,
      delegates,
      vestingPlans,
      vestingAdmin,
      true,
      lockupPlans,
      true,
      3
    );
    let tokenId = await lock.totalSupply();
    let vestingPlanInfo = await vesting.plans(tokenId);
    let lockPlanInfo = await lock.getVestingLock(tokenId);
    expect(await vesting.ownerOf(tokenId)).to.eq(lock.target);
    expect(await lock.ownerOf(tokenId)).to.eq(b.address);
    expect(vestingPlanInfo.token).to.eq(token.target);
    expect(vestingPlanInfo.amount).to.eq(amount);
    expect(vestingPlanInfo.start).to.eq(vestingStart);
    expect(vestingPlanInfo.cliff).to.eq(vestingCliff);
    expect(vestingPlanInfo.rate).to.eq(vestingRate);
    expect(vestingPlanInfo.period).to.eq(vestingPeriod);
    expect(vestingPlanInfo.vestingAdmin).to.eq(vestingAdmin);
    expect(vestingPlanInfo.adminTransferOBO).to.eq(false);
    expect(lockPlanInfo.token).to.eq(token.target);
    expect(lockPlanInfo.totalAmount).to.eq(amount);
    expect(lockPlanInfo.availableAmount).to.eq(0);
    expect(lockPlanInfo.start).to.eq(lockStart);
    expect(lockPlanInfo.cliff).to.eq(lockCliff);
    expect(lockPlanInfo.rate).to.eq(lockRate);
    expect(lockPlanInfo.period).to.eq(lockPeriod);
    expect(lockPlanInfo.vestingAdmin).to.eq(vestingAdmin);
    expect(lockPlanInfo.vestingTokenId).to.eq(tokenId);
    expect(lockPlanInfo.transferable).to.eq(true);
    expect(lockPlanInfo.adminTransferOBO).to.eq(true);
    if (params.voting) {
      let votingVault = await vesting.votingVaults(tokenId);
      expect(await token.delegates(votingVault)).to.eq(delegate);
    } else {
      expect(await vesting.delegatedTo(tokenId)).to.eq(delegate);
    }
  });
};

const createErrorTests = () => {
  let deployed, admin, a, b, c, d, token, nvt, vesting, batch, lock;
  let amount, vestingStart, vestingCliff, vestingRate, vestingPeriod, vestingEnd, vestingAdmin, vestingPlan, delegate, delegates;
  let lockStart, lockCliff, lockRate, lockPeriod, lockEnd, lockupPlan, recipient;
  it('should revert with (lenError) if the recipients len or locks len or vestingPlans len are different', async () => {
    deployed = await deploy(18);
    admin = deployed.admin;
    a = deployed.a;
    b = deployed.b;
    c = deployed.c;
    d = deployed.d;
    delegate = d.address;
    delegates = [delegate];
    token = deployed.token;
    nvt = deployed.nvt;
    batch = deployed.batch;
    vesting = deployed.tvp;
    lock = deployed.vestingLock;
    let now = BigInt(await time.latest());
    amount = C.E18_1000;
    vestingStart = now;
    vestingCliff = now;
    vestingRate = C.E18_1;
    vestingPeriod = 1;
    vestingPlan = {
      amount,
      start: vestingStart,
      cliff: vestingCliff,
      rate: vestingRate,
      period: vestingPeriod,
    };
    lockStart = now + BigInt(100);
    lockCliff = lockStart;
    lockRate = C.E18_1;
    lockPeriod = 1;
    lockupPlan = {
      amount,
      start: lockStart,
      cliff: lockCliff,
      rate: lockRate,
      period: lockPeriod,
    };
    recipient = {
      beneficiary: a.address,
      adminRedeem: true,
    };
    await expect(
      batch.createVestingLockupPlans(
        lock.target,
        token.target,
        amount,
        [recipient, recipient],
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('lenError');
    await expect(
      batch.createVestingLockupPlansWithDelegation(
        lock.target,
        token.target,
        amount,
        [recipient, recipient],
        [delegate, delegate],
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('lenError');
    await expect(
      batch.createVestingLockupPlans(
        lock.target,
        token.target,
        amount,
        [recipient],
        [vestingPlan, vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('lenError');
    await expect(
      batch.createVestingLockupPlansWithDelegation(
        lock.target,
        token.target,
        amount,
        [recipient],
        delegates,
        [vestingPlan, vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('lenError');
    await expect(
      batch.createVestingLockupPlans(
        lock.target,
        token.target,
        amount,
        [recipient],
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan, lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('lenError');
    await expect(
      batch.createVestingLockupPlansWithDelegation(
        lock.target,
        token.target,
        amount,
        [recipient],
        [delegate],
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan, lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('lenError');
  });
  it('should revert with (0_totalAmount) if the total amount equals 0', async () => {
    await expect(
      batch.createVestingLockupPlans(
        lock.target,
        token.target,
        0,
        [recipient],
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('0_totalAmount');
    await expect(
      batch.createVestingLockupPlansWithDelegation(
        lock.target,
        token.target,
        0,
        [recipient],
        delegates,
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('0_totalAmount');
  });
  it('should revert with (totalAmount error) if the amount check is different than the total amount input', async () => {
    await expect(
      batch.createVestingLockupPlans(
        lock.target,
        token.target,
        amount - BigInt(100),
        [recipient],
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        2
      )
    ).to.be.revertedWith('THL01');
    await expect(
      batch.createVestingLockupPlans(
        lock.target,
        token.target,
        amount + BigInt(100),
        [recipient],
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        2
      )
    ).to.be.revertedWith('totalAmount error');
    await expect(
      batch.createVestingLockupPlansWithDelegation(
        lock.target,
        token.target,
        amount - BigInt(100),
        [recipient],
        delegates,
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        2
      )
    ).to.be.revertedWith('THL01');
    await expect(
      batch.createVestingLockupPlansWithDelegation(
        lock.target,
        token.target,
        amount + BigInt(100),
        [recipient],
        delegates,
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        2
      )
    ).to.be.revertedWith('totalAmount error');
  });
  it('should revert with (allocated) if the vestingPlan has already been allocated', async () => {
    await batch.createVestingLockupPlans(
      lock.target,
      token.target,
      amount,
      [recipient],
      [vestingPlan],
      admin.address,
      true,
      [lockupPlan],
      true,
      1
    );
    await expect(
      lock.createVestingLock(recipient, 1, lockStart, lockCliff, lockRate, lockPeriod, false, false)
    ).to.be.revertedWith('allocated');
  });
  it('should revert with (!ownerOfNFT) if the lock contract is not the owner', async () => {
    await expect(
      lock.createVestingLock(recipient, 2, lockStart, lockCliff, lockRate, lockPeriod, false, false)
    ).to.be.revertedWith('ERC721: invalid token ID');
    await token.approve(vesting.target, amount * BigInt(100000));
    await vesting.createPlan(
      a.address,
      token.target,
      amount,
      vestingStart,
      vestingCliff,
      vestingRate,
      vestingPeriod,
      admin.address,
      true
    );
    await expect(
      lock.createVestingLock(recipient, 2, lockStart, lockCliff, lockRate, lockPeriod, false, false)
    ).to.be.revertedWith('!ownerOfNFT');
  });
  it('should revert if neither the batch creator of the vesting plan admin attempt to create', async () => {
    await vesting.transferFrom(a.address, lock.target, 2);
    await expect(
      lock.connect(a).createVestingLock(recipient, 2, lockStart, lockCliff, lockRate, lockPeriod, false, false)
    ).to.be.reverted;
  });
  it('should revert with (0_amount) if the amount of the vesting plan is 0', async () => {
    vestingPlan.amount = 0;
    await expect(
      batch.createVestingLockupPlans(
        lock.target,
        token.target,
        amount,
        [recipient],
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('0_amount');
    await expect(
      batch.createVestingLockupPlansWithDelegation(
        lock.target,
        token.target,
        amount,
        [recipient],
        delegates,
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('0_amount');
    vestingPlan.amount = amount;
  });
  it('should revert with (0_rate) if the rate of the plan is 0', async () => {
    vestingPlan.rate = 0;
    await expect(
      batch.createVestingLockupPlans(
        lock.target,
        token.target,
        amount,
        [recipient],
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('0_rate');
    await expect(
      batch.createVestingLockupPlansWithDelegation(
        lock.target,
        token.target,
        amount,
        [recipient],
        delegates,
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('0_rate');
    vestingPlan.rate = vestingRate;
    lockupPlan.rate = 0;
    await expect(
      batch.createVestingLockupPlans(
        lock.target,
        token.target,
        amount,
        [recipient],
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('0_rate');
    await expect(
      batch.createVestingLockupPlansWithDelegation(
        lock.target,
        token.target,
        amount,
        [recipient],
        delegates,
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('0_rate');
    lockupPlan.rate = lockRate;
  });
  it('should revert with (rate > amount) if the rate is greater than the amount', async () => {
    vestingPlan.rate = amount + BigInt(1);
    await expect(
      batch.createVestingLockupPlans(
        lock.target,
        token.target,
        amount,
        [recipient],
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('rate > amount');
    await expect(
      batch.createVestingLockupPlansWithDelegation(
        lock.target,
        token.target,
        amount,
        [recipient],
        delegates,
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('rate > amount');
    vestingPlan.rate = vestingRate;
    lockupPlan.rate = amount + BigInt(1);
    await expect(
      batch.createVestingLockupPlans(
        lock.target,
        token.target,
        amount,
        [recipient],
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('rate > amount');
    await expect(
      batch.createVestingLockupPlansWithDelegation(
        lock.target,
        token.target,
        amount,
        [recipient],
        delegates,
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('rate > amount');
    lockupPlan.rate = lockRate;
  });
  it('should revert with (0_period) if the period of the plan is 0', async () => {
    vestingPlan.period = 0;
    await expect(
      batch.createVestingLockupPlans(
        lock.target,
        token.target,
        amount,
        [recipient],
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('0_period');
    await expect(
      batch.createVestingLockupPlansWithDelegation(
        lock.target,
        token.target,
        amount,
        [recipient],
        delegates,
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('0_period');
    vestingPlan.period = vestingPeriod;
    lockupPlan.period = 0;
    await expect(
      batch.createVestingLockupPlans(
        lock.target,
        token.target,
        amount,
        [recipient],
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('0_period');
    await expect(
      batch.createVestingLockupPlansWithDelegation(
        lock.target,
        token.target,
        amount,
        [recipient],
        delegates,
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('0_period');
    lockupPlan.period = lockPeriod;
  });
  it('should revert with (cliff > end) if the cliff is greater than the end', async () => {
    vestingEnd = C.planEnd(vestingStart, amount, vestingRate, vestingPeriod);
    vestingPlan.cliff = vestingEnd + BigInt(1);
    await expect(
      batch.createVestingLockupPlans(
        lock.target,
        token.target,
        amount,
        [recipient],
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('cliff > end');
    await expect(
      batch.createVestingLockupPlansWithDelegation(
        lock.target,
        token.target,
        amount,
        [recipient],
        delegates,
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('cliff > end');
    vestingPlan.cliff = vestingStart;
    lockEnd = C.planEnd(lockStart, amount, lockRate, lockPeriod);
    lockupPlan.cliff = lockEnd + BigInt(1);
    await expect(
      batch.createVestingLockupPlans(
        lock.target,
        token.target,
        amount,
        [recipient],
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('cliff > end');
    await expect(
      batch.createVestingLockupPlansWithDelegation(
        lock.target,
        token.target,
        amount,
        [recipient],
        delegates,
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('cliff > end');
    lockupPlan.cliff = lockStart;
  });
  it('should revert with (end error) if the end is greater than the vesting end', async () => {
    vestingPlan.start = lockEnd;
    await expect(
      batch.createVestingLockupPlans(
        lock.target,
        token.target,
        amount,
        [recipient],
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('end error');
    await expect(
      batch.createVestingLockupPlansWithDelegation(
        lock.target,
        token.target,
        amount,
        [recipient],
        delegates,
        [vestingPlan],
        admin.address,
        true,
        [lockupPlan],
        true,
        1
      )
    ).to.be.revertedWith('end error');
  });
};

module.exports = {
  createTests,
  createErrorTests,
};
