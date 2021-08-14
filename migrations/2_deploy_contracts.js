const FlightSuretyApp = artifacts.require("FlightSuretyApp");
const FlightSuretyData = artifacts.require("FlightSuretyData");
const fs = require("fs");

module.exports = async function (deployer) {
  let firstAirline = "0xf17f52151EbEF6C7334FAD080c5704D77216b732";

  await deployer.deploy(FlightSuretyData);
  await deployer.deploy(FlightSuretyApp);

  const [data, app] = await Promise.all(
    [FlightSuretyData, FlightSuretyApp].map((instance) => instance.deployed())
  );

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

  await app.registerAirline(firstAirline);
};
