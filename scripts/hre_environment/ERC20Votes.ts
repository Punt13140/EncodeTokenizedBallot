import { ethers } from "hardhat";
import { MyToken__factory } from "../../typechain-types";

const MINT_VALUE = ethers.parseUnits("1");

async function main() {
  // Deploy the contract
  const [deployer, acc1, acc2] = await ethers.getSigners();
  const contractFactory = new MyToken__factory(deployer);
  const contract = await contractFactory.deploy();
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  console.log(`Token contract deployed at ${contractAddress}\n`);

  // Mint some tokens
  const mintTx = await contract.mint(acc1.address, MINT_VALUE);
  await mintTx.wait();
  console.log(
    `Minted ${MINT_VALUE.toString()} decimal units to account ${acc1.address}\n`
  );
  const balanceBN = await contract.balanceOf(acc1.address);
  console.log(
    `Account ${
      acc1.address
    } has ${balanceBN.toString()} decimal units of MyToken\n`
  );

  // Check votes
  const votes = await contract.getVotes(acc1.address);
  console.log(
    `Account ${
      acc1.address
    } has ${votes.toString()} units of voting power before self delegating\n`
  );

  // Self delegate
  const delegateTx = await contract.connect(acc1).delegate(acc1.address);
  await delegateTx.wait();
  const votesAfter = await contract.getVotes(acc1.address);
  console.log(
    `Account ${
      acc1.address
    } has now ${votesAfter.toString()} units of voting power after self delegating\n`
  );

  // Transfer tokens
  const transferTx = await contract
    .connect(acc1)
    .transfer(acc2.address, MINT_VALUE / 3n);
  await transferTx.wait();
  const votes1AfterTransfer = await contract.getVotes(acc1.address);
  console.log(
    `Account ${
      acc1.address
    } has ${votes1AfterTransfer.toString()} units of voting power after transferring\n`
  );
  const votes2AfterTransfer = await contract.getVotes(acc2.address);
  console.log(
    `Account ${
      acc2.address
    } has ${votes2AfterTransfer.toString()} units of voting power after receiving a transfer\n`
  );

  // Check past votes
  const lastBlock = await ethers.provider.getBlock("latest");
  const lastBlockNumber = lastBlock?.number ?? 0;
  for (let index = lastBlockNumber - 1; index > 0; index--) {
    const pastVotes = await contract.getPastVotes(acc1.address, index);
    console.log(
      `Account ${
        acc1.address
      } had ${pastVotes.toString()} units of voting power at block ${index}\n`
    );
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
