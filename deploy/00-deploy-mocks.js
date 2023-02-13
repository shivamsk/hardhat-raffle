
const { network,ethers } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")

const BASE_FEE = ethers.utils.parseEther("0.25")
const GAS_PRICE_LINK = 1e9


module.exports = async function({getNamedAccounts, deployments}){
    const {deploy, log} = deployments
    const{deployer} = await getNamedAccounts()
    const chainId = network.config.chainId

    if(developmentChains.includes(network.name)){
        log("Local Network Detected !! Deploying Mocks")

        // Use the Mock from Chainlink Mocks
        // https://github.com/smartcontractkit/chainlink/blob/develop/contracts/src/v0.8/mocks/VRFCoordinatorV2Mock.sol

        await deploy("VRFCoordinatorV2Mock" , {
            from : deployer,
            log : true, 
            args: [BASE_FEE, GAS_PRICE_LINK],
        })

        log("Mocks Deployed!")
        log("----------------------------------------------------------")
        log("You are deploying to a local network, you'll need a local network running to interact")
        log(
            "Please run `yarn hardhat console --network localhost` to interact with the deployed smart contracts!"
        )
        log("----------------------------------------------------------")
    }
}

module.exports.tags = ["all", "mocks"]
