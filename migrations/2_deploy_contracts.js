const FlightSuretyApp = artifacts.require("FlightSuretyApp");
const FlightSuretyData = artifacts.require("FlightSuretyData");
const fs = require("fs");

module.exports = async function (deployer) {
  // Can be generated from the mnemonic
  let firstAirline = "0xf17f52151EbEF6C7334FAD080c5704D77216b732";

  await deployer.deploy(FlightSuretyData);

  const data = await FlightSuretyData.deployed();

  await deployer.deploy(FlightSuretyApp, data.address);
  const app = await FlightSuretyApp.deployed();

  let config = {
    localhost: {
      url: "http://localhost:8545",
      dataAddress: data.address,
      appAddress: app.address,
    },
  };
  fs.writeFileSync(
    __dirname + "/../src/dapp/config.json",
    JSON.stringify(config, null, "\t"),
    "utf-8"
  );
  fs.writeFileSync(
    __dirname + "/../src/server/config.json",
    JSON.stringify(config, null, "\t"),
    "utf-8"
  );

  await data.authorizeCaller(app.address);
  await app.registerAirline(firstAirline);
};
