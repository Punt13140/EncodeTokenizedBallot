import { ethers } from "hardhat";
import { MyToken__factory } from "../../typechain-types";

async function main() {
  const accounts = await ethers.getSigners();
  const tokenContractFactory = new MyToken__factory(accounts[0]);
  const tokenContract = await tokenContractFactory.deploy();
  await tokenContract.waitForDeployment();
  const tokenContractAddress = await tokenContract.getAddress();
  console.log(`Contract deployed at ${tokenContractAddress}`);

  const initialSupply = await tokenContract.totalSupply();
  console.log(`Initial supply is ${initialSupply.toString()} decimals units`);

  const code = await tokenContract.MINTER_ROLE();
  const roleTx = await tokenContract.grantRole(code, accounts[2].address);
  await roleTx.wait();

  const mintTx = await tokenContract
    .connect(accounts[2])
    .mint(accounts[0].address, 2);
  await mintTx.wait();

  const [name, symbol, decimals, totalSupply] = await Promise.all([
    tokenContract.name(),
    tokenContract.symbol(),
    tokenContract.decimals(),
    tokenContract.totalSupply(),
  ]);
  console.log({ name, symbol, decimals, totalSupply });

  const myBalance = await tokenContract.balanceOf(accounts[0].address);
  console.log(`My Balance is ${ethers.formatUnits(myBalance)} ${symbol} units`);
  const otherBalance = await tokenContract.balanceOf(accounts[1].address);
  console.log(
    `The Balance of Acc1 is ${ethers.formatUnits(otherBalance)} ${symbol} units`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
