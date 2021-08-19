import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import FlightSuretyData from "../../build/contracts/FlightSuretyData.json";
import Config from "./config.json";
import Web3 from "web3";

export default class Contract {
  constructor(network, callback) {
    let config = Config[network];
    this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
    this.flightSuretyApp = new this.web3.eth.Contract(
      FlightSuretyApp.abi,
      config.appAddress
    );
    this.flightSuretyData = new this.web3.eth.Contract(
      FlightSuretyData.abi,
      config.dataAddress
    );
    this.initialize(callback);
    this.owner = null;
    this.airlines = [];
    this.passengers = [];
  }

  initialize(callback) {
    this.web3.eth.getAccounts((error, accts) => {
      this.owner = accts[0];
      let counter = 1;

      while (this.airlines.length < 5) {
        this.airlines.push(accts[counter++]);
      }

      while (this.passengers.length < 5) {
        this.passengers.push(accts[counter++]);
      }

      callback();
    });
  }

  isOperational(callback) {
    let self = this;
    self.flightSuretyApp.methods
      .isOperational()
      .call({ from: self.owner }, callback);
  }

  payMembership() {
    const AMOUNT_10_ETH = this.web3.utils.toWei("10", "ether");
    let self = this;

    return this.flightSuretyData.methods.fund().send({
      from: self.airlines[0],
      value: AMOUNT_10_ETH,
    });
  }

  registerFlight(flight, timestamp) {
    let self = this;

    return this.flightSuretyData.methods
      .getMembershipFee()
      .call({
        from: self.airlines[0],
      })
      .then((x) => {
        console.log(`current membership fee: ${x}`);
        return self.flightSuretyApp.methods
          .registerFlight(flight, timestamp)
          .send({
            from: self.airlines[0],
            gas: 3000000,
          });
      });
  }

  getFlights() {
    return this.flightSuretyData.methods.getFlightList().call();
  }

  getRefund() {
    let self = this;
    return this.flightSuretyData.methods.getRefund().call({
      from: self.passengers[0],
    });
  }

  claimRefund() {
    let self = this;
    this.flightSuretyData.methods
      .getTotalFund()
      .call({
        from: self.passengers[0],
      })
      .then(console.log);
    return this.flightSuretyApp.methods.pay().send({
      from: self.passengers[0],
    });
  }

  buyInsurance({ airline, flight, timestamp, value }) {
    let self = this;

    this.flightSuretyData.methods
      .getFlightStatusCode(airline, flight, timestamp)
      .call({ from: self.passengers[0] })
      .then(console.log);

    this.flightSuretyData.methods
      .getOrder(airline, flight, timestamp)
      .call({ from: self.passengers[0] })
      .then((x) => {
        console.log(`current amount for this flight is : ${x}`);
        return this.flightSuretyData.methods
          .buy(airline, flight, timestamp)
          .send({
            from: self.passengers[0],
            gas: 3000000,
            value: self.web3.utils.toWei(String(value), "ether"),
          });
      });
  }

  fetchFlightStatus({ flight, airline, timestamp }) {
    let self = this;

    return self.flightSuretyApp.methods
      .fetchFlightStatus(airline, flight, timestamp)
      .send({ from: self.owner });
  }
}
