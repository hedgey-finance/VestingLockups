const { ethers, run } = require('hardhat');
const { setTimeout } = require('timers/promises');


async function createLockPlans(batchAddress, tokenAddress, lockAddress, totalAmount, planData) {
    const batch = (await ethers.getContractFactory('BatchCreator')).attach(batchAddress);
    const token = (await ethers.getContractFactory('Token')).attach(tokenAddress);
    const lock = (await ethers.getContractFactory('VotingTokenLockupPlans')).attach(lockAddress);
     // approve
     await token.approve(batchAddress, totalAmount);
    // create
}