pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/
    uint private totalFund = 0;

    address private contractOwner; // Account used to deploy contract
    bool private operational = true; // Blocks all state changes throughout the contract if false

    mapping(address => bool) private registered; // Airline is registered or not
    uint private registration = 0;

    enum Status {
        PENDING,
        APPROVED
    }

    struct Registration {
      uint id;
      address airline;
      Status status;
    }

    Registration[] registrationQueue; // Track the registrations which need votes
    mapping(address => uint) voteCount; // Number of votes for the airlines

    // Fees paid by airlines
    mapping(address => uint) fees;

    mapping(address => mapping(address => bool)) private approvals;

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
      require(fees[msg.sender] >= 10 ether, "Not authorized to perform action");
      _;
    }

    modifier onlyRegistered() {
      require(registered[msg.sender] == true, "Only registered airline");
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
     * Approve the registration
     */
    function approveRegistration(uint id) external onlyAuthorizedAirline() {
      // Can't approve twice for the same airline
      Registration memory reg = registrationQueue[id];

      if (approvals[msg.sender][reg.airline] == false) {
        approvals[msg.sender][reg.airline] = true;
        voteCount[reg.airline].add(1);
      }

      if (voteCount[reg.airline] >= registration/2) {
        registrationQueue[reg.id].status = Status.APPROVED;

        registered[reg.airline] = true;
        registration.add(1);
      }
    }

    /**
     * Only registered airline can pay membership
     */
    function payMembership() external onlyRegistered() payable {
      fees[msg.sender].add(msg.value);
      totalFund.add(msg.value);
    }

    /**
     * @dev Add an airline to the registration queue
     *      Can only be called from FlightSuretyApp contract
     *
     */
    function registerAirline(address airline) external returns (bool, uint256) {
      require(registered[airline] == false, "Airline registered!");

      // First airline, no check
      if (registration == 0) {
        registration += 1;
        registered[airline] = true;
        return (true, 0);
      }

      // Non-registered airline can't register others
      if (registered[msg.sender] != true) {
        return (false, 0);
      }

      // Up to 4th registration, no multi party consensus
      if (registration < 4) {
        registration += 1;
        registered[airline] = true;
        return (true, 0);
      }

      // 5th one onwards, add to queue for voting
      // It's okay to have same airline being in the queue multiple times
      registrationQueue.push(Registration(
        registrationQueue.length,
        airline,
        Status.PENDING
      ));

      return (false, voteCount[airline]);
    }

    /**
     * @dev Buy insurance for a flight
     *
     */
    function buy() external payable {}

    /**
     *  @dev Credits payouts to insurees
     */
    function creditInsurees() external pure {}

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
     */
    function pay() external pure {}

    /**
     * @dev Initial funding for the insurance. Unless there are too many delayed flights
     *      resulting in insurance payouts, the contract should be self-sustaining
     *
     */
    function fund() public payable {}

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
