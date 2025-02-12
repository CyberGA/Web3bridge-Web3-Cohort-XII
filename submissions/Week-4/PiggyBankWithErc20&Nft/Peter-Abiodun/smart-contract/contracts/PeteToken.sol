// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./IPeteToken.sol";

contract PeteToken is ERC20, IPeteToken {
    constructor(uint256 initialSupply) ERC20("Pete", "PETE") {
        _mint(msg.sender, initialSupply);
    }

    function mint(address to, uint256 amount) external override {
        _mint(to, amount);
    }
}
