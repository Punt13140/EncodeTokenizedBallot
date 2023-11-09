import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { MyNFT, MyToken } from "../typechain-types/contracts";

const TEST_RATIO = 10n;
const TEST_PRICE = 1n;
const TEST_BUY_VALUE = ethers.parseUnits("10"); // trying to buy 10 ETH worth of tokens

describe("NFT Shop", async () => {
  async function deployContracts() {
    const accounts = await ethers.getSigners();
    const tokenSaleContractFactory = await ethers.getContractFactory(
      "TokenSale"
    );
    const myTokenContractFactory = await ethers.getContractFactory("MyToken");
    const myNFTContractFactory = await ethers.getContractFactory("MyNFT");

    const myTokenContract = await myTokenContractFactory.deploy();
    await myTokenContract.waitForDeployment();

    const myNFTContract = await myNFTContractFactory.deploy();
    await myNFTContract.waitForDeployment();

    const tokenSaleContract = await tokenSaleContractFactory.deploy(
      TEST_RATIO,
      TEST_PRICE,
      myTokenContract.target,
      myNFTContract.target
    );
    await tokenSaleContract.waitForDeployment();

    const MINTER_ROLE = await myTokenContract.MINTER_ROLE();
    const roleTx = await myTokenContract.grantRole(
      MINTER_ROLE,
      tokenSaleContract.target
    );
    await roleTx.wait();
    const roleNftTx = await myNFTContract.grantRole(
      MINTER_ROLE,
      tokenSaleContract.target
    );
    await roleNftTx.wait();

    return { accounts, tokenSaleContract, myTokenContract, myNFTContract };
  }
  async function buyTokens() {
    const { accounts, tokenSaleContract, myTokenContract, myNFTContract } =
      await loadFixture(deployContracts);
    const buyer = accounts[1];
    const initialBalance = await buyer.provider.getBalance(buyer.address);
    const tx = await tokenSaleContract
      .connect(buyer)
      .buyTokens({ value: TEST_BUY_VALUE });
    const txReceipt = await tx.wait();
    const gasUsed = txReceipt?.gasUsed ?? 0n;
    const gasPrice = txReceipt?.gasPrice ?? 0n;
    const gasCost = gasUsed * gasPrice;
    const finalBalance = await buyer.provider.getBalance(buyer.address);
    return {
      accounts,
      tokenSaleContract,
      myTokenContract,
      myNFTContract,
      txReceipt,
      buyer,
      initialBalance,
      finalBalance,
      gasCost,
    };
  }
  async function burnTokens() {
    const { buyer, accounts, tokenSaleContract, myTokenContract } =
      await loadFixture(buyTokens);
    const expectedBalance = TEST_BUY_VALUE * TEST_RATIO;
    const ethBalanceBefore = await ethers.provider.getBalance(buyer.address);
    const allowTx = await myTokenContract
      .connect(buyer)
      .approve(tokenSaleContract.target, expectedBalance);
    const allowTxReceipt = await allowTx.wait();
    const allowTxGasUsed = allowTxReceipt?.gasUsed ?? 0n;
    const allowTxPricePerGas = allowTxReceipt?.gasPrice ?? 0n;
    const allowTxGasCosts = allowTxGasUsed * allowTxPricePerGas;
    const burnTx = await tokenSaleContract
      .connect(buyer)
      .returnTokens(expectedBalance);
    await burnTx.wait();
    const burnTxReceipt = await burnTx.wait();
    const burnTxGasUsed = burnTxReceipt?.gasUsed ?? 0n;
    const burnTxPricePerGas = burnTxReceipt?.gasPrice ?? 0n;
    const burnTxGasCosts = burnTxGasUsed * burnTxPricePerGas;
    const ethBalanceAfter = await ethers.provider.getBalance(buyer.address);
    const gasCosts = allowTxGasCosts + burnTxGasCosts;
    return {
      buyer,
      accounts,
      tokenSaleContract,
      myTokenContract,
      ethBalanceBefore,
      gasCosts,
      ethBalanceAfter,
    };
  }
  async function buyNft() {
    const {
      buyer,
      accounts,
      tokenSaleContract,
      myTokenContract,
      myNFTContract,
    } = await loadFixture(buyTokens);
    const allowTx = await myTokenContract
      .connect(buyer)
      .approve(tokenSaleContract.target, TEST_PRICE);
    await allowTx.wait();

    const nftId = 0;
    const txReceipt = await tokenSaleContract.connect(buyer).buyNFT(nftId);
    await txReceipt.wait();
    return {
      buyer,
      accounts,
      tokenSaleContract,
      myTokenContract,
      myNFTContract,
      txReceipt,
      nftId,
    };
  }

  describe("When the Shop contract is deployed", async () => {
    it("defines the ratio as provided in parameters", async () => {
      const { tokenSaleContract } = await loadFixture(deployContracts);
      const ratio = await tokenSaleContract.ratio();
      expect(ratio).to.eq(TEST_RATIO);
    });
    it("defines the price as provided in parameters", async () => {
      const { tokenSaleContract } = await loadFixture(deployContracts);
      const price = await tokenSaleContract.price();
      expect(price).to.eq(TEST_PRICE);
    });
    it("uses a valid ERC20 as payment token", async () => {
      const { tokenSaleContract } = await loadFixture(deployContracts);
      const tokenAddress = await tokenSaleContract.paymentToken();
      const paymentTokenContractFactory = await ethers.getContractFactory(
        "MyToken"
      );
      const paymentTokenContract = paymentTokenContractFactory.attach(
        tokenAddress
      ) as MyToken;
      await expect(paymentTokenContract.totalSupply()).not.to.be.reverted;
      await expect(paymentTokenContract.balanceOf(ethers.ZeroAddress)).not.to.be
        .reverted;
    });

    it("uses a valid ERC721 as NFT collection", async () => {
      const { tokenSaleContract, accounts } = await loadFixture(
        deployContracts
      );
      const tokenAddress = await tokenSaleContract.nftContract();
      const paymentTokenContractFactory = await ethers.getContractFactory(
        "MyNFT"
      );
      const nftContract = paymentTokenContractFactory.attach(
        tokenAddress
      ) as MyNFT;

      // Don't know what we should check here exactly
      await expect(nftContract.balanceOf(ethers.ZeroAddress)).to.be.reverted;
      await expect(nftContract.balanceOf(accounts[1])).not.to.be.reverted;
    });
  });
  describe("When a user buys an ERC20 from the Token contract", async () => {
    it("charges the correct amount of ETH", async () => {
      const { initialBalance, finalBalance, gasCost } = await loadFixture(
        buyTokens
      );
      const diff = initialBalance - finalBalance;
      const expectedDiff = TEST_BUY_VALUE + gasCost;
      const error = diff - expectedDiff;

      expect(error).to.eq(0);
    });
    it("gives the correct amount of tokens", async () => {
      const { myTokenContract, buyer } = await loadFixture(buyTokens);
      const balance = await myTokenContract.balanceOf(buyer.address);

      expect(balance).to.eq(TEST_BUY_VALUE * TEST_RATIO);
    });
  });
  describe("When a user burns an ERC20 at the Shop contract", async () => {
    it("gives the correct amount of ETH", async () => {
      const { ethBalanceBefore, ethBalanceAfter, gasCosts } = await loadFixture(
        burnTokens
      );
      const diff = ethBalanceAfter - ethBalanceBefore;
      const expectDiff = TEST_BUY_VALUE - gasCosts;
      const error = diff - expectDiff;
      expect(error).to.eq(0);
    });
    it("burns the correct amount of tokens", async () => {
      const { buyer, myTokenContract } = await loadFixture(burnTokens);
      const balanceAfterBurn = await myTokenContract.balanceOf(buyer.address);
      expect(balanceAfterBurn).to.eq(0);
    });
  });
  describe("When a user buys an NFT from the Shop contract", async () => {
    it("charges the correct amount of ERC20 tokens", async () => {
      throw new Error("Not implemented");
    });
    it("gives the correct NFT", async () => {
      const { buyer, nftId, myNFTContract } = await loadFixture(buyNft);
      const nftOwner = await myNFTContract.ownerOf(nftId);
      expect(nftOwner).to.eq(buyer.address);
    });
  });
  describe("When a user burns their NFT at the Shop contract", async () => {
    it("gives the correct amount of ERC20 tokens", async () => {
      throw new Error("Not implemented");
    });
  });
  describe("When the owner withdraws from the Shop contract", async () => {
    it("recovers the right amount of ERC20 tokens", async () => {
      throw new Error("Not implemented");
    });
    it("updates the owner pool account correctly", async () => {
      throw new Error("Not implemented");
    });
  });
});
