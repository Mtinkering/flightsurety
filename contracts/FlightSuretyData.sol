pragma solidity ^0.4.25;
pragma experimental ABIEncoderV2;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/
    // uint private constant MULTIPLER = 3/2;

    uint private totalFund = 0;

    address private caller;
    address private contractOwner; // Account used to deploy contract
    bool private operational = true; // Blocks all state changes throughout the contract if false

    uint8 private constant STATUS_CODE_OPEN_PURCHASE = 255;

    mapping(address => bool) private registered; // Airline is registered or not
    uint private committee = 0; // How many are there in the committee

    enum Status {
        PENDING,
        APPROVED
    }

    struct Registration {
      uint id;
      address airline;
      Status status;
    }

    struct Purchase {
      address customer;
      uint amount;
    }

    Registration[] private registrationQueue; // Track the registrations which need votes
    mapping(address => uint) private voteCount; // Number of votes for the airlines

    // Fees paid by airlines
    mapping(address => uint) private fees;

    mapping(address => mapping(address => bool)) private approvals;

    /* Passengers */
    mapping(address => mapping(bytes32 => uint)) orders; // Mapping of customer to flight he purchases with amount

    mapping(bytes32 => Purchase[]) purchases; // Flight key to all the purchases

    mapping(address => uint) refund; // Mapping of the refund he should receive


    /* Flights */
    struct Flight {
      bool isRegistered;
      uint8 statusCode;
      uint256 timestamp;
      address airline;
      string flight;
    }
    mapping(bytes32 => Flight) private flights;
    Flight[] private flightList;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    /**
     * @dev Constructor
     *      The deploying account becomes contractOwner
     */
    constructor() public {
      contractOwner = msg.sender;
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
     * @dev Modifier that requires the "operational" boolean variable to be "true"
     *      This is used on all state changing functions to pause the contract in
     *      the event there is an issue that needs to be fixed
     */
    modifier requireIsOperational() {
      require(operational, "Contract is currently not operational");
      _; // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
     * @dev Modifier that requires the "ContractOwner" account to be the function caller
     */
    modifier requireContractOwner() {
      require(msg.sender == contractOwner, "Caller is not contract owner");
      _;
    }

    modifier onlyAuthorizedAirline() {
      require(fees[tx.origin] >= 10 ether, "Not paid membership fee");
      _;
    }

    modifier onlyRegistered() {
      require(registered[tx.origin] == true, "Only registered airline");
      _;
    }
    
    modifier onlyAuthorizedCaller() {
      require(msg.sender == caller, "Caller is not authorized to call the contract");
      _;
    }
    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/
    /**
     * @dev Get operating status of contract
     *
     * @return A bool that is the current operating status
     */
    function isOperational() public view returns (bool) {
      return operational;
    }

    /**
     * @dev Sets contract operations on/off
     *
     * When operational mode is disabled, all write transactions except for this one will fail
     */
    function setOperatingStatus(bool mode) external requireContractOwner {
      operational = mode;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     */
    function getOrder(
      address airline,
      string flight,
      uint timestamp
    ) external view returns (uint) {
      bytes32 key = getFlightKey(airline, flight, timestamp);
      return orders[tx.origin][key];
    }

    /**
     */
    function getVoteCount(address airline) external view returns (uint) {
      return voteCount[airline];
    }

    /**
     */
    function getCommittee() external view returns (uint) {
      return committee;
    }

    /**
     */
    function getTotalFund() external view returns (uint) {
      return totalFund;
    }

    /**
     */
    function getMembershipFee() external view returns (uint) {
      return fees[tx.origin];
    }

    /**
     */
    function getRegistrationQueue() external view returns (Registration[] memory) {
      return registrationQueue;
    }

    /**
     * Check if the airline is registered
     */
    function isAirlineRegistered(address airline) external view returns (bool) {
      return registered[airline];
    }

    /**
     * List of flights available to purchase insurance
     */
    function getFlightList() external view returns (Flight[] memory) {
      return flightList;
    }

    /**
     * Check refund for a customer
     */
    function getRefund() external view returns (uint) {
      return refund[tx.origin];
    }

    /**
     * Authorize the contract that can call this contract
     */
    function authorizeCaller(address appCaller) external requireContractOwner() {
      caller = appCaller;
    }

    /**
     * Approve the registration
     */
    function approveRegistration(uint id) external onlyAuthorizedAirline() onlyAuthorizedCaller() {
      Registration memory reg = registrationQueue[id];

      // Can't approve twice for the same airline
      if (approvals[tx.origin][reg.airline] == false) {
        approvals[tx.origin][reg.airline] = true;
        voteCount[reg.airline] = voteCount[reg.airline].add(1);
      }

      if (voteCount[reg.airline] >= committee/2) {
        registrationQueue[reg.id].status = Status.APPROVED;

        registered[reg.airline] = true;
        committee += 1;
      }
    }

    /**
     * @dev Register a future flight for insuring.
     *  Only airline that paid the fee
     */
    function registerFlight(
      string flight,
      uint timestamp,
      uint8 statusCode
    ) external onlyAuthorizedAirline() onlyAuthorizedCaller() {

      bytes32 key = getFlightKey(tx.origin, flight, timestamp);
      require(!flights[key].isRegistered, "Flight registered");
      Flight memory f = Flight(true, statusCode, timestamp, tx.origin, flight);
      flights[key] = f;
      flightList.push(f);
    }

    /**
     * @dev Add an airline to the registration queue
     *      Can only be called from FlightSuretyApp contract
     *
     */
    function registerAirline(address airline) external onlyAuthorizedCaller() {
      require(registered[airline] == false, "Airline registered");

      // First airline, no check
      if (committee == 0) {
        committee += 1;
        registered[airline] = true;
        return;
      }

      // Non-registered airline can't register others
      if (registered[tx.origin] != true) {
        return;
      }

      // Up to 4th registration, no multi party consensus
      if (committee < 4) {
        committee += 1;
        registered[airline] = true;
        return;
      }

      // 5th one onwards, add to queue for voting
      // It's okay to have same airline being in the queue multiple times
      registrationQueue.push(Registration(
        registrationQueue.length,
        airline,
        Status.PENDING
      ));

      return;
    }

    function updateFlightStatusCode(
      address airline,
      string flight,
      uint256 timestamp,
      uint8 statusCode
    ) external onlyAuthorizedCaller() {
      bytes32 key = getFlightKey(airline, flight, timestamp);
      flights[key].statusCode = statusCode;
    }

    /**
     * @dev Buy insurance for a flight
     *
     */
    function buy(
      address airline,
      string flight,
      uint timestamp
    ) external payable {
      require(msg.value <= 1 ether, "Purchase is limited to 1 ether for a flight");
      bytes32 key = getFlightKey(airline, flight, timestamp);

      require(flights[key].isRegistered == true, "Flight is not registered");

      uint amount = orders[tx.origin][key];
      require(msg.value.add(amount) <= 1 ether, "Total purchase is too much for a flight");

      // Flight must be open for purchase
      require(flights[key].statusCode == STATUS_CODE_OPEN_PURCHASE, "Flight is no longer available for purchase");

      totalFund = totalFund.add(msg.value);

      orders[tx.origin][key] = orders[tx.origin][key].add(msg.value);

      purchases[key].push(Purchase(
        tx.origin,
        msg.value
      ));
    }

    /**
     *  @dev Credits payouts to insurees
     */
    function creditInsurees(
      address airline,
      string flight,
      uint256 timestamp
    ) external onlyAuthorizedCaller() {
      // Get the key then multiply the profit for all passengers
      bytes32 key = getFlightKey(airline, flight, timestamp);
      Purchase[] memory assured = purchases[key];

      for (uint i = 0; i < assured.length; i++) {
        address customer = assured[i].customer;
        uint amount = assured[i].amount;
        refund[customer] = refund[customer].add(amount.mul(3).div(2));
      }
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
     */
    function pay() external onlyAuthorizedCaller() {
      uint refundAmount = refund[tx.origin];

      require(refundAmount <= totalFund, "Fund insufficient");
      refund[tx.origin] = 0;

      totalFund -= refundAmount;

      tx.origin.transfer(refundAmount);
    }

    /**
     * @dev Initial funding for the insurance. Unless there are too many delayed flights
     *      resulting in insurance payouts, the contract should be self-sustaining
     *      Only registered airline can pay membership
     *
     */
    function fund() public onlyRegistered() payable  {
      fees[tx.origin] = fees[tx.origin].add(msg.value);
      totalFund = totalFund.add(msg.value);
    }

    function getFlightKey(
        address airline,
        string memory flight,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
     * @dev Fallback function for funding smart contract.
     *
     */
    function() external payable {
        fund();
    }
}
