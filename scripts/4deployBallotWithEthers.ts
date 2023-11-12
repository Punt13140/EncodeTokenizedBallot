import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import {
  MyToken,
  MyToken__factory,
  TokenizedBallot__factory,
} from "../typechain-types";
dotenv.config();

async function main() {
  const parameters = process.argv.slice(2);
  console.log({ parameters });
  if (!parameters || parameters.length < 4)
    throw new Error("Parameters not provided");

  const tokenContractAddress = parameters[0];
  const blockNumber = Number(parameters[1]);
  const proposals = parameters.slice(3);

  // Configuring the provider
  const provider = new ethers.JsonRpcProvider(
    process.env.RPC_ENDPOINT_URL ?? ""
  );
  const lastBlock = await provider.getBlock("latest");
  console.log(`Last block number: ${lastBlock?.number}`);

  // Configuring the wallet
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY ?? "", provider);
  console.log(`Using address ${wallet.address}`);
  const balanceBN = await provider.getBalance(wallet.address);
  const balance = Number(ethers.formatUnits(balanceBN));
  console.log(`Wallet balance ${balance} ETH`);
  if (balance < 0.01) {
    throw new Error("Not enough ether");
  }

  // Check if the token contract is deployed/exists
  const tokenFactory = new MyToken__factory(wallet);
  const tokenContract = tokenFactory.attach(tokenContractAddress) as MyToken;
  try {
    const name = await tokenContract.name();
    console.log(`Token name: ${name}`);
    const symbol = await tokenContract.symbol();
    console.log(`Token symbol: ${symbol}`);
  } catch (error) {
    throw new Error(`Token contract not deployed at ${tokenContractAddress}`);
  }

  // Deploy the TokenizedBallot Contract
  const ballotFactory = new TokenizedBallot__factory(wallet);
  const ballotContract = await ballotFactory.deploy(
    proposals.map(ethers.encodeBytes32String),
    tokenContractAddress,
    blockNumber
  );
  await ballotContract.waitForDeployment();
  console.log(`Contract deployed to ${ballotContract.target}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});