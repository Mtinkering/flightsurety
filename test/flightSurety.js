const Test = require("../config/testConfig.js");
const { expectRevert } = require("@openzeppelin/test-helpers");

const Status = {
  PENDING: 0,
  APPROVED: 1,
};

const AMOUNT_5_ETH = web3.utils.toWei("5", "ether");
const AMOUNT_10_ETH = web3.utils.toWei("10", "ether");
const STATUS_CODE_OPEN_PURCHASE = 255;

contract("Flight Surety Tests", async (accounts) => {
  let config;
  beforeEach("setup contract", async () => {
    config = await Test.Config(accounts);
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  // it(`(multiparty) has correct initial isOperational() value`, async function () {
  //   // Get operating status
  //   let status = await config.flightSuretyData.isOperational.call();
  //   assert.equal(status, true, "Incorrect initial operating status value");
  // });

  // it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {
  //   // Ensure that access is denied for non-Contract Owner account
  //   let accessDenied = false;
  //   try {
  //     await config.flightSuretyData.setOperatingStatus(false, {
  //       from: config.testAddresses[2],
  //     });
  //   } catch (e) {
  //     accessDenied = true;
  //   }
  //   assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
  // });

  // it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {
  //   // Ensure that access is allowed for Contract Owner account
  //   let accessDenied = false;
  //   try {
  //     await config.flightSuretyData.setOperatingStatus(false);
  //   } catch (e) {
  //     accessDenied = true;
  //   }
  //   assert.equal(
  //     accessDenied,
  //     false,
  //     "Access not restricted to Contract Owner"
  //   );
  // });

  // it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {
  //   await config.flightSuretyData.setOperatingStatus(false);

  //   let reverted = false;
  //   try {
  //     await config.flightSurety.setTestingMode(true);
  //   } catch (e) {
  //     reverted = true;
  //   }
  //   assert.equal(reverted, true, "Access not blocked for requireIsOperational");

  //   // Set it back for other tests to work
  //   await config.flightSuretyData.setOperatingStatus(true);
  // });

  /****************************************************************************************/
  /* Airline registration                                                                  */
  /****************************************************************************************/

  it("registers first airline from deployment", async () => {
    let result = await config.data.isAirlineRegistered(accounts[1]);
    assert.equal(result, true, "First airline should be registered");
  });

  it("throws for registering again", async () => {
    await expectRevert(
      config.app.registerAirline(config.firstAirline, {
        from: config.owner,
      }),
      "Airline registered"
    );
  });

  it("1- allows only existing airline to register a new airline until there are at least four airlines registered", async () => {
    await config.app.registerAirline(accounts[2], {
      from: accounts[3],
    });

    let result = await config.data.isAirlineRegistered(accounts[2]);
    assert.equal(result, false, "Non registered airline can't regiser others");
  });

  it("2- allows only existing airline to register a new airline until there are at least four airlines registered", async () => {
    const { app, data } = config;

    await app.registerAirline(accounts[2], {
      from: accounts[1],
    });
    await app.registerAirline(accounts[3], {
      from: accounts[2],
    });
    await app.registerAirline(accounts[4], {
      from: accounts[3],
    });

    assert.equal(
      await data.isAirlineRegistered(accounts[2]),
      true,
      "Airline 2 is registered"
    );

    assert.equal(
      await data.isAirlineRegistered(accounts[3]),
      true,
      "Airline 3 is registered"
    );
    assert.equal(
      await data.isAirlineRegistered(accounts[4]),
      true,
      "Airline 4 is registered"
    );

    ("=====  ================ =======");
    await app.registerAirline(accounts[5], {
      from: accounts[4],
    });

    assert.equal(
      await data.isAirlineRegistered(accounts[5]),
      false,
      "Airline 5 is not registered"
    );

    const result = await data.getRegistrationQueue();
    assert.equal(result.length, 1, "Airline 5 is in the queue");
    assert.equal(result[0].id, 0, "Id 0");
    assert.equal(result[0].airline, accounts[5]);
    assert.equal(result[0].status, Status.PENDING);

    assert.equal(await data.getCommittee(), 4);
  });

  it("cannot register an Airline using registerAirline() if it is not funded", async () => {
    const { app, data } = config;

    // Register 3 airlines more
    await app.registerAirline(accounts[2], {
      from: accounts[1],
    });
    await app.registerAirline(accounts[3], {
      from: accounts[1],
    });
    await app.registerAirline(accounts[4], {
      from: accounts[1],
    });
    await app.registerAirline(accounts[5], {
      from: accounts[1],
    });

    // Now we need the vote from first 4 airlines, but they haven't paid funding
    const registrationIdInTheQueue = 0;
    await expectRevert(
      app.approveRegistration(registrationIdInTheQueue, {
        from: accounts[1],
      }),
      "Not paid membership fee"
    );

    assert.equal(
      await data.isAirlineRegistered(accounts[5]),
      false,
      "Airline 5 is not registered"
    );
  });

  it("can approve airline registration if already paid membership fee", async () => {
    const { app, data } = config;

    // Register 3 airlines more
    await app.registerAirline(accounts[2], {
      from: accounts[1],
    });
    await app.registerAirline(accounts[3], {
      from: accounts[1],
    });
    await app.registerAirline(accounts[4], {
      from: accounts[1],
    });
    await app.registerAirline(accounts[5], {
      from: accounts[1],
    });

    // Now we need the vote from first 4 airlines, but they haven't paid funding
    await web3.eth.sendTransaction({
      from: accounts[1],
      to: data.address,
      value: AMOUNT_5_ETH,
    });

    assert.equal(
      await data.getMembershipFee({
        from: accounts[1],
      }),
      AMOUNT_5_ETH,
      "fee from first time"
    );
    assert.equal(
      await data.getTotalFund(),
      AMOUNT_5_ETH,
      "total fund after 1st"
    );

    // Pay again
    await web3.eth.sendTransaction({
      from: accounts[1],
      to: data.address,
      value: AMOUNT_5_ETH,
    });
    assert.equal(
      await data.getMembershipFee({
        from: accounts[1],
      }),
      AMOUNT_10_ETH,
      "fee from second time"
    );
    assert.equal(
      await data.getTotalFund(),
      AMOUNT_10_ETH,
      "total fund after 2nd"
    );

    const registrationIdInTheQueue = 0;
    await app.approveRegistration(registrationIdInTheQueue, {
      from: accounts[1],
    });
    assert.equal(
      await data.getVoteCount(accounts[5]),
      1,
      "1 vote for airline 5 registration from account 1"
    );
    assert.equal(
      await config.data.isAirlineRegistered(accounts[5]),
      false,
      "Airline 5 is not registered as not enough votes yet"
    );

    // Account 2 pays membership fee
    await web3.eth.sendTransaction({
      from: accounts[2],
      to: data.address,
      value: AMOUNT_10_ETH,
    });
    assert.equal(
      await data.getMembershipFee({
        from: accounts[2],
      }),
      AMOUNT_10_ETH,
      "fee from acc 2"
    );
    assert.equal(
      await data.getTotalFund(),
      AMOUNT_10_ETH * 2,
      "total fund is 20 eth"
    );

    await app.approveRegistration(registrationIdInTheQueue, {
      from: accounts[2],
    });
    assert.equal(
      await data.getVoteCount(accounts[5]),
      2,
      "2 vote for airline 5 registration from account 1 and 2"
    );
    assert.equal(
      await config.data.isAirlineRegistered(accounts[5]),
      true,
      "Airline 5 is registered"
    );

    const result = await data.getRegistrationQueue();
    assert.equal(result[0].airline, accounts[5]);
    assert.equal(result[0].status, Status.APPROVED);

    assert.equal(await data.getCommittee(), 5);
  });

  /****************************************************************************************/
  /* Flight                                                              */
  /****************************************************************************************/
  it("allows airline that paid fees to register flight", async () => {
    const { app, data } = config;

    await expectRevert(
      app.registerFlight("FLIGHT01", Math.floor(Date.now() / 1000), {
        from: accounts[1], // first airline
      }),
      "Not paid membership fee"
    );

    // Now pay membership fee
    await web3.eth.sendTransaction({
      from: accounts[1],
      to: data.address,
      value: AMOUNT_10_ETH,
    });

    // Then can register flight
    const t = Math.floor(Date.now() / 1000);
    await app.registerFlight("FLIGHT01", t, {
      from: accounts[1], // first airline
    });
    const flights = await data.getFlightList();
    assert.equal(flights.length, 1);
    assert.equal(flights[0].isRegistered, true);
    assert.equal(flights[0].statusCode, STATUS_CODE_OPEN_PURCHASE);
    assert.equal(flights[0].timestamp, t);
    assert.equal(flights[0].airline, accounts[1]);
    assert.equal(flights[0].flight, "FLIGHT01");

    // But can't register the same flight with same departure again
    await expectRevert(
      app.registerFlight("FLIGHT01", t, {
        from: accounts[1], // first airline
      }),
      "Flight registered"
    );
  });
});
