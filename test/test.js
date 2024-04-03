const C = require('./constants');
const { createTests, createErrorTests } = require('./tests/createTests');
const happyPath = require('./tests/happyPath');
const { clientMTests, clientM2Test } = require('./tests/realWorldTests');
const { playground } = require('./tests/playground');
const { editTests } = require('./tests/editTests');
const { revokeTests } = require('./tests/revokeTests');
const { transferTests } = require('./tests/transferTests');
const { managerTests } = require('./tests/managerTests');


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
    }
]


// describe('Testing the happy path', () => {
//     happyPath();
// });

// describe('Testing the playground tests', () => {
//     playground();
// })


// describe('Testing the createTests', () => {
//     paramsMatrix.forEach((params) => {
//         createTests(params);
//     });
//     createErrorTests();
// });


// describe('Testing the edit function', () => {
//     editTests();
// })


// describe('Testing the revoke function', () => {
//     revokeTests();
// });

// describe('Testing the transfer function', () => {
//     transferTests();
// });

describe('Testing the manager functions', () => {
    managerTests();
});
