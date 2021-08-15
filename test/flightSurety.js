const Test = require("../config/testConfig.js");
const BigNumber = require("bignumber.js");
const { expectRevert } = require("@openzeppelin/test-helpers");

contract("Flight Surety Tests", async (accounts) => {
  let config;
  before("setup contract", async () => {
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

  it("registers first airline from deployment", async () => {
    await expectRevert(
      config.app.getsomething(config.firstAirline, {
        from: config.owner,
      }),
      "Airline registered!"
    );
  });

  it.only("allows only existing airline to register a new airline until there are at least four airlines registered", async () => {
    let result = await config.app.getsomething.call();
    console.log(result);
    console.log(result.t);
    console.log(result.d);
    // console.log(result.length);
    // assert.equal(success, false);
    // assert.equal(check, 0);
  });

  it("(airline) cannot register an Airline using registerAirline() if it is not funded", async () => {
    // ARRANGE
    let newAirline = accounts[2];

    // ACT
    try {
      await config.flightSuretyApp.registerAirline(newAirline, {
        from: config.firstAirline,
      });
    } catch (e) {}
    let result = await config.flightSuretyData.isAirline.call(newAirline);

    // ASSERT
    assert.equal(
      result,
      false,
      "Airline should not be able to register another airline if it hasn't provided funding"
    );
  });

  it("checks registration of fifth and subsequent airlines requires multi-party consensus of 50% of registered airlines", async () => {});
});
