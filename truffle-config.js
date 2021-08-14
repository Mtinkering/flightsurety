// Use ganache with this seed phrase
var mnemonic =
  "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";

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
