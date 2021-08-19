import DOM from "./dom";
import Contract from "./contract";
import "./flightsurety.css";

(async () => {
  let result = null;
  let flightToPurchase = [];
  let flightToCheckStatus = [];
  let contract = new Contract("localhost", () => {
    // Read transaction
    contract.isOperational((error, result) => {
      // console.log(error, result);
      display("Operational Status", "Check if contract is operational", [
        { label: "Operational Status", error: error, value: result },
      ]);
    });

    // User-submitted transaction
    DOM.elid("insure-flight-status-button").addEventListener(
      "click",
      async () => {
        try {
          let el = DOM.elid(
            "flight-available-section-for-status-check"
          ).firstElementChild;
          if (el) {
            const idx = el.selectedIndex;
            let data = flightToCheckStatus[idx];
            const { flight, timestamp, airline } = data;
            await contract.fetchFlightStatus({ flight, airline, timestamp });
          }
        } catch (e) {
          console.error(e);
        }
      }
    );

    // User-submitted transaction
    DOM.elid("airline-pay-membership").addEventListener("click", async () => {
      try {
        await contract.payMembership();
        alert("successfully fund the airline");
      } catch (e) {
        console.log(e);
      }
    });

    DOM.elid("flight-register-button").addEventListener("click", async () => {
      let flight = DOM.elid("flight-number").value;
      let timestamp = DOM.elid("flight-timestamp").value;
      try {
        await contract.registerFlight(flight, timestamp);
        alert(`successfully register flight: ${flight} ${timestamp}`);
      } catch (e) {
        console.log(e);
      }
    });

    DOM.elid("passenger-get-flights-button").addEventListener(
      "click",
      async () => {
        try {
          flightToPurchase = await contract.getFlights();
          console.log(flightToPurchase);
          let select = DOM.select();
          flightToPurchase.forEach((flight, idx) => {
            let option = DOM.option(
              { value: idx },
              `${flight.flight} : ${new Date(flight.timestamp * 1000)} : ${
                flight.airline
              }: ${flight.statusCode}`
            );
            select.appendChild(option);
          });
          DOM.elid("flight-available-section").innerHTML = "";
          DOM.elid("flight-available-section").appendChild(select);
        } catch (e) {
          console.log(e);
        }
      }
    );
    DOM.elid(
      "flight-available-section-for-status-check-button"
    ).addEventListener("click", async () => {
      try {
        flightToCheckStatus = await contract.getFlights();
        console.log(flightToCheckStatus);
        let select = DOM.select();
        flightToCheckStatus.forEach((flight, idx) => {
          let option = DOM.option(
            { value: idx },
            `${flight.flight} : ${new Date(flight.timestamp * 1000)} : ${
              flight.airline
            } : ${flight.statusCode}`
          );
          select.appendChild(option);
        });
        DOM.elid("flight-available-section-for-status-check").innerHTML = "";
        DOM.elid("flight-available-section-for-status-check").appendChild(
          select
        );
      } catch (e) {
        console.log(e);
      }
    });

    DOM.elid("passenger-buy-insurance-button").addEventListener(
      "click",
      async () => {
        try {
          let el = DOM.elid("flight-available-section").firstElementChild;
          if (el) {
            const value = DOM.elid("passenger-buy-amount").value;
            const idx = el.selectedIndex;
            let data = flightToPurchase[idx];
            const { flight, timestamp, airline } = data;
            await contract.buyInsurance({ flight, timestamp, airline, value });
          }
        } catch (e) {
          console.log(e);
        }
      }
    );

    DOM.elid("passenger-check-refund-button").addEventListener(
      "click",
      async () => {
        try {
          const amount = await contract.getRefund();
          DOM.elid("passenger-refund-amount").value = amount;
        } catch (e) {
          console.log(e);
        }
      }
    );

    DOM.elid("passenger-claim-refund-button").addEventListener(
      "click",
      async () => {
        try {
          const amount = await contract.claimRefund();
          DOM.elid("passenger-refund-amount").value = 0;
        } catch (e) {
          console.log(e);
        }
      }
    );
  });
})();

function display(title, description, results) {
  let displayDiv = DOM.elid("display-wrapper");
  let section = DOM.section();
  section.appendChild(DOM.h2(title));
  section.appendChild(DOM.h5(description));
  results.map((result) => {
    let row = section.appendChild(DOM.div({ className: "row" }));
    row.appendChild(DOM.div({ className: "col-sm-4 field" }, result.label));
    row.appendChild(
      DOM.div(
        { className: "col-sm-8 field-value" },
        result.error ? String(result.error) : String(result.value)
      )
    );
    section.appendChild(row);
  });
  displayDiv.append(section);
}
