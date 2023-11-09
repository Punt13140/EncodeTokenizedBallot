// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IMyToken is IERC20{
    function mint(address to, uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
}

interface IMyNFT is IERC721{
    function safeMint(address to, uint256 tokenId) external;
}

contract TokenSale {
    uint256 public ratio;
    uint256 public price;
    IMyToken public paymentToken;
    IMyNFT public nftContract;

    constructor(uint256 _ratio, uint256 _price, IMyToken _paymentToken, IMyNFT _nftContract) {
        ratio = _ratio;
        price = _price;
        paymentToken = _paymentToken;
        nftContract = _nftContract;
    }

    function buyTokens() external payable {
        paymentToken.mint(msg.sender, msg.value * ratio);
    }

    function returnTokens(uint256 amount) external {
        paymentToken.burnFrom(msg.sender, amount);
        payable(msg.sender).transfer(amount / ratio);
    }

    function buyNFT(uint256 tokenId) external {
        paymentToken.transferFrom(msg.sender, address(this), price);
        nftContract.safeMint(msg.sender, tokenId);
    }
}