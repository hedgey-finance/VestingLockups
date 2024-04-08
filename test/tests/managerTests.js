const C = require('../constants');
const { deploy } = require('../fixtures');
const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

const managerTests = () => {
  let deployed, admin, a, b, c, d, token, vesting, batch, lock, recipient;
  let amount, vestingPlan, lockPlan;
  it('manager can update the base URI', async () => {
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

    let tx = await lock.updateBaseURI('newURI');
    expect(tx).to.emit(lock, 'URISet').withArgs('newURI');
    await expect(lock.connect(a).updateBaseURI('newUri')).to.be.revertedWith('!M');
  });
  it('manager can change itself to new manager address', async () => {
    let tx = await lock.changeManager(a.address);
    expect(tx).to.emit(lock, 'ManagerChanged').withArgs(a.address);
    await expect(lock.connect(admin).changeManager(admin.address)).to.be.revertedWith('!M');
  });
  it('manager can change the plan creator contract address', async () => {
    deployed = await deploy(18);
    let newBatch = (batch = deployed.batch);
    await lock.connect(a).updatePlanCreator(newBatch.target);
    await expect(lock.connect(admin).updatePlanCreator(newBatch.target)).to.be.revertedWith('!M');
  });
};

module.exports = { managerTests };
