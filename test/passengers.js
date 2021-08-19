const Test = require("../config/testConfig.js");
const BigNumber = require("bignumber.js");
const { expectRevert } = require("@openzeppelin/test-helpers");

const Status = {
  PENDING: 0,
  APPROVED: 1,
};

const AMOUNT_1_ETH = web3.utils.toWei("1", "ether");
const AMOUNT_5_ETH = web3.utils.toWei("5", "ether");
const AMOUNT_10_ETH = web3.utils.toWei("10", "ether");
const STATUS_CODE_OPEN_PURCHASE = 255;
const STATUS_CODE_UNKNOWN = 0;
const STATUS_CODE_ON_TIME = 10;
const STATUS_CODE_LATE_AIRLINE = 20;
const STATUS_CODE_LATE_WEATHER = 30;
const STATUS_CODE_LATE_TECHNICAL = 40;
const STATUS_CODE_LATE_OTHER = 50;

const runOracle = async ({
  app,
  flight,
  airline,
  timestamp,
  statusCode,
  accounts,
}) => {
  // ARRANGE
  const TEST_ORACLES_COUNT = 20;
  const fee = await app.REGISTRATION_FEE.call();

  // ACT
  for (let i = 0; i < TEST_ORACLES_COUNT; i++) {
    await app.registerOracle({ from: accounts[i], value: fee });
    let result = await app.getMyIndexes.call({ from: accounts[i] });
  }

  // Submit a request for oracles to get status information for a flight
  await app.fetchFlightStatus(airline, flight, timestamp);

  for (let i = 1; i < TEST_ORACLES_COUNT; i++) {
    // Get oracle information
    let oracleIndexes = await app.getMyIndexes.call({
      from: accounts[i],
    });
    for (let idx = 0; idx < 3; idx++) {
      try {
        await app.submitOracleResponse(
          oracleIndexes[idx],
          airline,
          flight,
          timestamp,
          statusCode,
          { from: accounts[i] }
        );
      } catch (e) {
        // Enable this when debugging
        // console.log(
        //   "\nError",
        //   idx,
        //   oracleIndexes[idx].toNumber(),
        //   flight,
        //   timestamp
        // );
      }
    }
  }
};

contract("Flight Surety Tests For Passengers", async (accounts) => {
  let config;
  beforeEach("setup contract", async () => {
    config = await Test.Config(accounts);
  });

  it("allows passengers to purchase registered flight with limit 1 eth", async () => {
    const { app, data } = config;

    // Airline preparation
    await web3.eth.sendTransaction({
      from: accounts[1],
      to: data.address,
      value: AMOUNT_10_ETH,
    });
    const t = Math.floor(Date.now() / 1000);
    await app.registerFlight("FLIGHT01", t, {
      from: accounts[1], // first airline
    });

    const flights = await data.getFlightList();
    assert.equal(flights.length, 1);

    let { airline, flight, timestamp } = flights[0];
    await data.buy(airline, flight, timestamp, {
      from: accounts[41], // passengers can start from account 41
      value: AMOUNT_1_ETH,
    });

    assert.equal(
      await data.getOrder(accounts[1], "FLIGHT01", t, {
        from: accounts[41],
      }),
      AMOUNT_1_ETH,
      "Can buy with 1 eth"
    );
  });

  it("allows passengers to purchase registered flight with limit 1 eth in total", async () => {
    const { app, data } = config;

    // Airline preparation
    await web3.eth.sendTransaction({
      from: accounts[1],
      to: data.address,
      value: AMOUNT_10_ETH,
    });
    const t = Math.floor(Date.now() / 1000);
    await app.registerFlight("FLIGHT01", t, {
      from: accounts[1], // first airline
    });
    const flights = await data.getFlightList();
    assert.equal(flights.length, 1);

    let { airline, flight, timestamp } = flights[0];

    await expectRevert(
      data.buy(airline, flight, timestamp, {
        from: accounts[41], // passengers can start from account 41
        value: AMOUNT_5_ETH,
      }),
      "Purchase is limited to 1 ether for a flight"
    );

    // Buy first time with 1 ether but then buy more
    await data.buy(airline, flight, timestamp, {
      from: accounts[41], // passengers can start from account 41
      value: AMOUNT_1_ETH,
    });
    await expectRevert(
      data.buy(airline, flight, timestamp, {
        from: accounts[41], // passengers can start from account 41
        value: AMOUNT_1_ETH,
      }),
      "Total purchase is too much for a flight"
    );
  });

  it("allows passengers to purchase registered flight, not random flight", async () => {
    const { app, data } = config;

    // Airline preparation
    await web3.eth.sendTransaction({
      from: accounts[1],
      to: data.address,
      value: AMOUNT_10_ETH,
    });
    const t = Math.floor(Date.now() / 1000);
    await app.registerFlight("FLIGHT01", t, {
      from: accounts[1], // first airline
    });
    const flights = await data.getFlightList();
    assert.equal(flights.length, 1);

    let { airline, flight, timestamp } = flights[0];

    await expectRevert(
      data.buy(airline, flight, timestamp + 1, {
        from: accounts[41], // passengers can start from account 41
        value: AMOUNT_1_ETH,
      }),
      "Flight is not registered"
    );
  });

  it("does not allow passengers to purchase registered flight that is already updated", async () => {
    const { app, data } = config;

    // Airline preparation
    await web3.eth.sendTransaction({
      from: accounts[1],
      to: data.address,
      value: AMOUNT_10_ETH,
    });
    const t = Math.floor(Date.now() / 1000);
    await app.registerFlight("FLIGHT01", t, {
      from: accounts[1], // first airline
    });
    const flights = await data.getFlightList();
    assert.equal(flights.length, 1);

    let { airline, flight, timestamp } = flights[0];

    await data.buy(airline, flight, timestamp, {
      from: accounts[41], // passengers can start from account 41
      value: AMOUNT_1_ETH,
    });

    // Run oracle to get the status
    await runOracle({
      app,
      flight,
      airline,
      timestamp,
      statusCode: STATUS_CODE_LATE_WEATHER,
      accounts: accounts.slice(10), // start from account 10 for oracles
    });

    // Account 42 try to buy
    await expectRevert(
      data.buy(airline, flight, timestamp, {
        from: accounts[42],
        value: AMOUNT_1_ETH,
      }),
      "Flight is no longer available for purchase"
    );
  });

  it("calculates refund correctly and allows withdraw if fund is enough", async () => {
    const { app, data } = config;

    // Airline preparation
    await web3.eth.sendTransaction({
      from: accounts[1],
      to: data.address,
      value: AMOUNT_10_ETH,
    });
    assert.equal(
      await data.getTotalFund(),
      AMOUNT_10_ETH,
      "total fund should be 10 eth"
    );
    const t = Math.floor(Date.now() / 1000);
    await app.registerFlight("FLIGHT01", t, {
      from: accounts[1], // first airline
    });
    const flights = await data.getFlightList();
    assert.equal(flights.length, 1);

    let { airline, flight, timestamp } = flights[0];

    await data.buy(airline, flight, timestamp, {
      from: accounts[41], // passengers can start from account 41
      value: AMOUNT_1_ETH,
    });

    // STATUS_CODE_LATE_TECHNICAL
    await runOracle({
      app,
      flight,
      airline,
      timestamp,
      statusCode: STATUS_CODE_LATE_TECHNICAL,
      accounts: accounts.slice(10), // start from account 10 for oracles
    });

    // Passenger has 1.5eth to claim
    assert.equal(
      await data.getRefund({
        from: accounts[41],
      }),
      web3.utils.toWei("1.5", "ether"),
      "Get refund"
    );

    const totalFund = await data.getTotalFund();
    await app.pay({
      from: accounts[41],
    });

    assert.equal(
      await data.getTotalFund({
        from: accounts[41],
      }),
      totalFund - web3.utils.toWei("1.5", "ether")
    );
  });

  it("throws if fund is not enough", async () => {
    const { app, data } = config;

    // Airline preparation
    await web3.eth.sendTransaction({
      from: accounts[1],
      to: data.address,
      value: AMOUNT_10_ETH,
    });
    const t = Math.floor(Date.now() / 1000);
    await app.registerFlight("FLIGHT01", t, {
      from: accounts[1], // first airline
    });
    const flights = await data.getFlightList();
    assert.equal(flights.length, 1);

    let { airline, flight, timestamp } = flights[0];

    // We need 21 passengers purchasing same
    for (i = 0; i < 21; i++) {
      await data.buy(airline, flight, timestamp, {
        from: accounts[21 + i], // passengers can start from account 21
        value: AMOUNT_1_ETH,
      });
    }

    // STATUS_CODE_LATE_TECHNICAL
    await runOracle({
      app,
      flight,
      airline,
      timestamp,
      statusCode: STATUS_CODE_LATE_TECHNICAL,
      accounts: accounts.slice(10), // start from account 10 for oracles
    });

    for (i = 0; i < 20; i++) {
      await app.pay({
        from: accounts[21 + i],
      });
    }

    await expectRevert(
      app.pay({
        from: accounts[41],
      }),
      "Fund insufficient"
    );
  });
});
