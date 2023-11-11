import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { MyToken } from "../typechain-types";

const PROPOSALS = ["Test Prop 1", "Test Prop 2", "Test Prop 3"];
const MINT_VALUE = ethers.parseUnits("1");

function convertStringArrayToBytes32(array: string[]) {
  const bytes32Array = [];
  for (let index = 0; index < array.length; index++) {
    bytes32Array.push(ethers.encodeBytes32String(array[index]));
  }
  return bytes32Array;
}

describe("Tokenized Ballot", async () => {
  async function deployContracts() {
    const [accounts, myTokenContractFactory, TokenizedBallotFactory] =
      await Promise.all([
        ethers.getSigners(),
        ethers.getContractFactory("MyToken"),
        ethers.getContractFactory("TokenizedBallot"),
      ]);
    const deployer = accounts[0];
    const voter = accounts[1];

    const myTokenContract = await myTokenContractFactory.deploy();
    await myTokenContract.waitForDeployment();

    const mintTx = await myTokenContract.mint(voter.address, MINT_VALUE);
    await mintTx.wait();

    const delegateTx = await myTokenContract
      .connect(voter)
      .delegate(voter.address);
    await delegateTx.wait();

    const delegateTxBlockNumber = delegateTx?.blockNumber ?? 0;

    const TokenizedBallotContract = await TokenizedBallotFactory.deploy(
      convertStringArrayToBytes32(PROPOSALS),
      myTokenContract.target,
      delegateTxBlockNumber
    );
    await TokenizedBallotContract.waitForDeployment();
    return { deployer, voter, myTokenContract, TokenizedBallotContract };
  }
  describe("When the Tokenized Ballot contract is deployed", async () => {
    it("has the provided proposals", async () => {
      const { TokenizedBallotContract } = await loadFixture(deployContracts);
      for (let index = 0; index < PROPOSALS.length; index++) {
        const proposal = await TokenizedBallotContract.proposals(index);
        expect(ethers.decodeBytes32String(proposal.name)).to.eq(
          PROPOSALS[index]
        );
      }
    });
    it("defines target block number in the past", async () => {
      const { TokenizedBallotContract } = await loadFixture(deployContracts);
      const targetBlockNumber =
        await TokenizedBallotContract.targetBlockNumber();
      const lastBlock = await ethers.provider.getBlock("latest");
      const lastBlockNumber = lastBlock?.number ?? 0;
      expect(targetBlockNumber).lt(lastBlockNumber);
    });
    it("uses a valid ERC20 as payment token", async () => {
      const { TokenizedBallotContract, myTokenContract } = await loadFixture(
        deployContracts
      );
      const tokenAddress = await TokenizedBallotContract.tokenContract();
      const ballotTokenContract = myTokenContract.attach(
        tokenAddress
      ) as MyToken;
      await expect(ballotTokenContract.totalSupply()).not.to.be.reverted;
      await expect(ballotTokenContract.balanceOf(ethers.ZeroAddress)).not.to.be
        .reverted;
    });
    it("reverts when target block is not in the past", async () => {
      const { myTokenContract } = await loadFixture(deployContracts);
      const TokenizedBallotFactory = await ethers.getContractFactory(
        "TokenizedBallot"
      );
      const lastBlockNumber = await ethers.provider.getBlockNumber();
      await expect(
        TokenizedBallotFactory.deploy(
          convertStringArrayToBytes32(PROPOSALS),
          myTokenContract.target,
          lastBlockNumber + 1
        )
      ).to.be.revertedWith("Target block should be in the past!");
    });
  });
  describe("When the Voter vote", async () => {
    it("has voting power", async () => {
      const { voter, myTokenContract, TokenizedBallotContract } =
        await loadFixture(deployContracts);
      const votingPower = await TokenizedBallotContract.votingPower(
        voter.address
      );
      const voterBalance = await myTokenContract.balanceOf(voter.address);
      expect(votingPower).to.eq(voterBalance);
    });
    it("has correct voting power after partial vote", async () => {
      const { voter, myTokenContract, TokenizedBallotContract } =
        await loadFixture(deployContracts);
      const votingPowerBefore = await TokenizedBallotContract.votingPower(
        voter.address
      );
      const amountToVote = 100000n;
      const voteTx = await TokenizedBallotContract.connect(voter).vote(0, amountToVote);
      await voteTx.wait;
      const votingPowerAfter = await TokenizedBallotContract.votingPower(
        voter.address
      );
      const votingPowerDiff = votingPowerBefore - votingPowerAfter;
      expect(votingPowerDiff).to.eq(amountToVote);
    });
    it("reverts when voting more than allowed", async () => {
      const { voter, TokenizedBallotContract } = await loadFixture(
        deployContracts
      );
      const votingPower = await TokenizedBallotContract.votingPower(
        voter.address
      );
      await expect(
        TokenizedBallotContract.connect(voter).vote(0, votingPower + 1n)
      ).to.be.revertedWith("TokenizedBallot: trying to vote more than allowed");
    });
    it("reverts when voting more than allowed in multiple votes", async () => {
      const { voter, TokenizedBallotContract } = await loadFixture(
        deployContracts
      );
      const votingPower = await TokenizedBallotContract.votingPower(
        voter.address
      );
      const voteTx = await TokenizedBallotContract.connect(voter).vote(0, votingPower);
      await voteTx.wait();
      await expect(
        TokenizedBallotContract.connect(voter).vote(0, 1)
      ).to.be.revertedWith("TokenizedBallot: trying to vote more than allowed");
    });
  });
});
