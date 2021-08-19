import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import Config from "./config.json";
import Web3 from "web3";
import express from "express";

const ORACLES_COUNT = 20;
const INDEX_OFFSET = 10; // Reserve first 10 addresses for airlines and passengers

const STATUS_CODE_UNKNOWN = 0;
const STATUS_CODE_ON_TIME = 10;
const STATUS_CODE_LATE_AIRLINE = 20;
const STATUS_CODE_LATE_WEATHER = 30;
const STATUS_CODE_LATE_TECHNICAL = 40;
const STATUS_CODE_LATE_OTHER = 50;

const statuses = [
  STATUS_CODE_UNKNOWN,
  STATUS_CODE_ON_TIME,
  STATUS_CODE_LATE_AIRLINE,
  STATUS_CODE_LATE_WEATHER,
  STATUS_CODE_LATE_TECHNICAL,
  STATUS_CODE_LATE_OTHER,
];

let config = Config["localhost"];
let web3 = new Web3(
  new Web3.providers.WebsocketProvider(config.url.replace("http", "ws"))
);

function getRandomStatus() {
  return statuses[Math.floor(Math.random() * statuses.length)];
}

web3.eth.getAccounts().then((accounts) => {
  const oracleIndex = {};

  web3.eth.defaultAccount = accounts[0];
  let flightSuretyApp = new web3.eth.Contract(
    FlightSuretyApp.abi,
    config.appAddress
  );

  // Register oracles ===
  const promises = [];
  for (let i = INDEX_OFFSET; i < ORACLES_COUNT + INDEX_OFFSET; i++) {
    let p = flightSuretyApp.methods
      .registerOracle()
      .send({
        from: accounts[i],
        value: web3.utils.toWei("1", "ether"),
        gas: 3000000,
      })
      .then(() => {
        return flightSuretyApp.methods
          .getMyIndexes()
          .call({
            from: accounts[i],
          })
          .then((indices) => {
            oracleIndex[accounts[i]] = indices;
          });
      });
    promises.push(p);
  }

  Promise.all(promises).then(() => {
    console.log(oracleIndex);
  });

  // Oracle listener
  flightSuretyApp.events
    .OracleRequest({
      fromBlock: 0,
    })
    .on("data", function (event) {
      const { returnValues } = event;
      const { index, airline, flight, timestamp } = returnValues;
      Object.keys(oracleIndex).forEach((oracle) => {
        if (oracleIndex[oracle].includes(index)) {
          const data = [index, airline, flight, timestamp, getRandomStatus()];
          console.log(data);
          flightSuretyApp.methods.submitOracleResponse(...data).send({
            from: oracle,
          });
        }
      });
    });
});

const app = express();
app.get("/api", (req, res) => {
  res.send({
    message: "An API for use with your Dapp!",
  });
});

export default app;
