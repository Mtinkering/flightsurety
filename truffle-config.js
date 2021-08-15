// Use ganache with this seed phrase
var mnemonic =
  "prevent tent worth clinic chuckle smile move gate valley gain social path";

module.exports = {
  networks: {
    development: {
      network_id: "*",
      host: "127.0.0.1",
      port: 8545,
    },
  },
  compilers: {
    solc: {
      version: "^0.4.24",
    },
  },
};
