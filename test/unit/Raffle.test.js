const { assert, expect } = require('chai')
const { network, getNamedAccounts , deployments, ethers} = require('hardhat')
const {developmentChains, networkConfig} = require('../../helper-hardhat-config')

!developmentChains.includes(network.name) 
    ? describe.skip
    : describe("Raffle Unit Tests", async function(){
        let raffle,raffleContract,  vrfCoordinatorV2Mock, accounts, player, raffleEntraceFee, interval,
        deployer

        beforeEach(async function(){

            accounts = await ethers.getSigners()
            deployer = (await getNamedAccounts()).deployer
            player = accounts[1]
            await deployments.fixture(["all"])

            raffleContract = await ethers.getContract("Raffle")
            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")

            raffle = raffleContract.connect(player)

            raffleEntraceFee = await raffle.getEntranceFee()
            interval = await raffle.getInterval()
        })

        describe("constructor", async function(){
            it("initializes the raffle correctly", async function(){
                const raffleState = (await raffle.getRaffleState()).toString()
                assert.equal(raffleState, "0")
                assert.equal(interval.toString(),
                networkConfig[network.config.chainId]["keepersUpdateInterval"] )
            })
        })

        describe("enterRaffle", async function(){
            it("reverts when you don't pay enough", async function(){
                await expect(raffle.enterRaffle()).to.be.revertedWith(
                    "Raffle__SendMoreToEnterRaffle"
                )
            })

            it("records player when they enter", async () =>{
                await raffle.enterRaffle({value : raffleEntraceFee})

                const contractPlayer = await raffle.getPlayer(0)
                assert.equal(contractPlayer, player.address)
            })

            it("emits event on enter", async () => {
                await expect(raffle.enterRaffle({value : raffleEntraceFee})).to.emit(
                    raffle,
                    "RaffleEnter"
                )
            })

            it("doesn't allow entrance when raffle is calculating", async () => {
                await raffle.enterRaffle({ value: raffleEntraceFee })
                // for a documentation of the methods below, go here: https://hardhat.org/hardhat-network/reference
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                // we pretend to be a keeper for a second
                await raffle.performUpkeep([]) // changes the state to calculating for our comparison below
                await expect(raffle.enterRaffle({ value: raffleEntraceFee })).to.be.revertedWith( // is reverted as raffle is calculating
                    "Raffle__RaffleNotOpen"
                )
            })
        })

        describe("checkUpKeep", async () => {
            it("returns false if people haven't sent any ETH", async () => {
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                assert(!upkeepNeeded)
            })

            it("returns false if raffle isn't open", async () => {
                await raffle.enterRaffle({ value: raffleEntraceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                await raffle.performUpkeep([]) // changes the state to calculating
                const raffleState = await raffle.getRaffleState() // stores the new state
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                assert.equal(raffleState.toString() == "1", upkeepNeeded == false)
            })

            it("returns false if enough time hasn't passed", async () => {
                await raffle.enterRaffle({ value: raffleEntraceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() - 5]) // use a higher number here if this test fails
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                assert(!upkeepNeeded)
            })
            it("returns true if enough time has passed, has players, eth, and is open", async () => {
                await raffle.enterRaffle({ value: raffleEntraceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                assert(upkeepNeeded)
            })
        })

        describe("performUpkeep", () => {
            it("can only run if checkupkeep is true", async () => {
                await raffle.enterRaffle({ value: raffleEntraceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const tx = await raffle.performUpkeep("0x") 
                assert(tx)
            })

            it("reverts if checkup is false", async () => {
                await expect(raffle.performUpkeep("0x")).to.be.revertedWith( 
                    "Raffle__UpkeepNotNeeded"
                )
            })

            it("updates the raffle state and emits a requestId", async () => {
                await raffle.enterRaffle({value : raffleEntraceFee})
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })

                const txResponse = await raffle.performUpkeep("0x")
                const transactionReceipt = await txResponse.wait(1)
                const raffleState = await raffle.getRaffleState()
                const requestId = transactionReceipt.events[1].args.requestId

                assert(requestId.toNumber() > 0)

                assert(raffleState == 1) // 1 - calculating

            })
        })

        describe("fulfillRandomWords", () =>{
            beforeEach( async () => {
                await raffle.enterRaffle({ value: raffleEntraceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() - 5]) // use a higher number here if this test fails
                await network.provider.request({ method: "evm_mine", params: [] })
            })

            it("can only be called after performUpkeep", async () => {
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address))
                .to.be.revertedWith("nonexistent request")
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address))
                .to.be.revertedWith("nonexistent request")
            })

            it("picks a winner, resets the lottery, and sends the money" , async () =>{
                const additionalEntrants = 3 // 3 more players 

                const startingAccountIndex = 1 // deployer = 0

                for(i = startingAccountIndex ; i < startingAccountIndex + additionalEntrants ; i++){
                    const raffle = raffleContract.connect(accounts[i])
                    await raffle.enterRaffle({value : raffleEntraceFee})
                }

                const startingTimeStamp = await raffle.getLastTimeStamp()

                // performUpkeep (mock is chainlink keepers)
                // fulfillRandomWords( mock is chainlink VRF)
                // We will have to wait for the fulfillRandomWords to be called
                
                await new Promise(async (resolve, reject) =>{
                    // Listen for this WinnerPicked event and do whatever is in this below function
                    // Setting the timeout for testing in hardhat.config.js 
                    // If this event doesn't get fired in the 500s , this test will fail
                    raffle.once("WinnerPicked", async () => {
                        console.log("WinnerPicked Event Fired")
                        try{
                           

                            const recentWinner = await raffle.getRecentWinner()
                            console.log("RecentWinner" ,recentWinner )
                            console.log(accounts[0].address)
                            console.log(accounts[2].address)
                            console.log(accounts[1].address)
                            console.log(accounts[3].address)

                            const raffleState = await raffle.getRaffleState()
                            const endingTimeStamp = await raffle.getLastTimeStamp()

                            const numPlayers = await raffle.getNumberOfPlayers()
                            const winnerBalance = await accounts[2].getBalance()

                            assert.equal(numPlayers.toString(), "0")
                            assert.equal(raffleState, 0)

                            // // startingBalance + ( (raffleEntranceFee * additionalEntrances) + raffleEntranceFee )
                            assert.equal(winnerBalance.toString(), 
                                startingBalance.add(
                                    raffleEntraceFee
                                        .mul(additionalEntrances)
                                        .add(raffleEntraceFee)
                                ).toString()
                            )
                            assert(endingTimeStamp > startingTimeStamp)
                            resolve()

                        }catch(e){
                            reject(e)
                        }
                    })
                })

                // Firing the event by mocking the chainlink keepers and vrf coordinator
                const transaction = await raffle.performUpkeep("0x")
                const transactionReceipt = await transaction.wait(1)
                const startingBalance = await accounts[2].getBalance()
                // This will emit the above event
                await vrfCoordinatorV2Mock.fulfillRandomWords(
                    transactionReceipt.events[1].args.requestId,
                    raffle.address
                    )

            })
        })
    })