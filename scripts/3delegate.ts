import { ethers } from "hardhat";
import { MyToken, MyToken__factory } from "../typechain-types";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  // Receive parameters from command line
  const parameters = process.argv.slice(2);
  if (!parameters || parameters.length < 2)
    throw new Error("Parameters not provided");
  const contractAddress = parameters[0];
  const delegateTo = parameters[1];

  // Configuring the provider
  const provider = new ethers.JsonRpcProvider(
    process.env.RPC_ENDPOINT_URL ?? ""
  );

  // Configuring the wallet
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY ?? "", provider);
  console.log(`Using address ${wallet.address}`);
  const balanceBN = await provider.getBalance(wallet.address);
  const balance = Number(ethers.formatUnits(balanceBN));
  if (balance < 0.01) {
    throw new Error("Not enough ether");
  }

  // Attaching to the contract
  const tokenFactory = new MyToken__factory(wallet);
  const tokenContract = tokenFactory.attach(contractAddress) as MyToken;

  // Check delegation state
  const delegatedTo = await tokenContract.delegates(wallet.address);
  if (delegatedTo == ethers.ZeroAddress) {
    console.log(
      `${wallet.address} has not delegated yet. Delegating to ${delegateTo}...`
    );
  } else {
    console.log(
      `${wallet.address} already has delegated to ${delegatedTo}. Changing delegation to ${delegateTo}...`
    );
  }

  // Delegate
  const delegateTx = await tokenContract.delegate(delegateTo);
  await delegateTx.wait();

  const newDelegatedTo = await tokenContract.delegates(wallet.address);
  console.log(`${wallet.address} has delegated to ${newDelegatedTo}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});