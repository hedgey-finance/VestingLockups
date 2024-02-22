const bigMin = (a, b) => {
    a = BigInt(a);
    b = BigInt(b);
    if (a < b) return a;
    else return b;
  };
  
  const bigMax = (a, b) => {
    a = BigInt(a);
    b = BigInt(b);
    if (a > b) return a;
    else return b;
  };
  
  const randomBigNum = (max, min, decimals) => {
    let num = Math.round(Math.random() * max);
    num = BigInt(Math.max(num, min));
    num = BigInt(10 ** decimals) * num;
    return num;
  };

  const planEnd = (start, amount, rate, period) => {
    let duration = (BigInt(amount) / BigInt(rate)) * BigInt(period);
    duration = BigInt(amount) % BigInt(rate) === BigInt(0) ? duration : duration + BigInt(period);
    return start + duration;
  }

  const getRate = (amount, period, duration) => {
    return BigInt(period) * BigInt(amount) / BigInt(duration);
  }
  
  module.exports = {
    ZERO: BigInt(0),
    ONE: BigInt(1),
    E18_1: BigInt(10 ** 18), // 1e18
    E18_100: BigInt(10 ** 18) * BigInt(100), // 100e18
    E18_1000: BigInt(10 ** 18) * BigInt(1000), // 1000e18
    E18_10000: BigInt(10 ** 18) * BigInt(10000), // 1000e18
    E18_1000000: BigInt(10 ** 18) * BigInt(1000000), // 1000000e18
    ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
    DAY: BigInt(60 * 60 * 24),
    WEEK: BigInt(60 * 60 * 24 * 7),
    MONTH: BigInt(2628000),
    bigMin,
    bigMax,
    randomBigNum,
    planEnd,
    getRate
  };
  