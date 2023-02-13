
# 

## Reference : 
- https://github.com/PatrickAlphaC/hardhat-smartcontract-lottery-fcc


## Chainlink Random Number 

- https://docs.chain.link/vrf/v2/subscription/examples/get-a-random-number/
- Check the Contract present here. This is used in the Raffle Contract
- VrfCoordinator2 Goerli config : https://docs.chain.link/vrf/v2/subscription/supported-networks/#goerli-testnet
- 

## chai matchers

- https://ethereum-waffle.readthedocs.io/en/latest/matchers.html
- Check this documentation for the Testing 
- Used chai matchers, events

## 
- external Functions cheaper than public functions as Solidity knows that the own contract can't call these methods. 
- pure vs view in the getters ? 
- 

## Shorthand 
- https://www.npmjs.com/package/hardhat-shorthand
- Can use hh compile instead of yarn hardhat compile 

##
- https://automation.chain.link/


## Hardhat Network Reference
- https://hardhat.org/hardhat-network/docs/reference
- Use the methods here to test any scenario in the hardhat network local blockchain network 
- Used in the Raffle.test.js unit 
- await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])



