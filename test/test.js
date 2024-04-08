const C = require('./constants');
const { createTests, createErrorTests } = require('./tests/createTests');
const happyPath = require('./tests/happyPath');
const { testA, testB } = require('./tests/realWorldTests');
const { playground } = require('./tests/playground');
const { editTests } = require('./tests/editTests');
const { revokeTests } = require('./tests/revokeTests');
const { transferTests } = require('./tests/transferTests');
const { managerTests } = require('./tests/managerTests');
const { delegationTests } = require('./tests/delegationTests');
const { batchMinterTests } = require('./tests/batchMintertests');
const { redeemUnlockTests, redeemUnlockErrorTests } = require('./tests/redeemAndUnlockTests');

const paramsMatrix = [
  {
    decimals: 18,
    voting: true,
    amount: C.E18_100,
    start: 0,
    cliff: 0,
    duration: C.MONTH,
    vestingPeriod: 1,
    lockStart: C.WEEK,
    lockCliff: C.WEEK,
    lockDuration: C.WEEK * BigInt(4),
    lockPeriod: C.WEEK,
    adminRedeem: true,
  },
];

describe('Testing the createTests', () => {
    paramsMatrix.forEach((params) => {
        createTests(params);
    });
    createErrorTests();
});

// becasue of how hardhat cant reset time, have to run these individually
// describe('Testing one of the Real world tests', () => {
//     testA();
//     testB();
// })

describe('Testing the happy path', () => {
    happyPath();
});

describe('Testing the playground tests', () => {
    playground();
})



describe('Testing the edit function', () => {
    editTests();
})

describe('Testing the revoke function', () => {
    revokeTests();
});

describe('Testing the transfer function', () => {
    transferTests();
});

describe('Testing the manager functions', () => {
    managerTests();
});


describe('Testing the batch minter tests', () => {
    batchMinterTests(true);
    batchMinterTests(false);
});

describe('Testing the delegation functions', () => {
  paramsMatrix.forEach((params) => {
    delegationTests(params);
  });
});

describe('Testing the redeem and unlock functions', () => {
  paramsMatrix.forEach((params) => {
    redeemUnlockTests(params);
  });
  redeemUnlockErrorTests(paramsMatrix[0]);
});
