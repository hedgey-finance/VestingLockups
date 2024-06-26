// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract NonVotingToken is ERC20 {

  uint8 internal _decimals;

  constructor(string memory name, string memory symbol, uint256 initialSupply, uint8 __decimals) ERC20(name, symbol) {
    _mint(msg.sender, initialSupply);
    _decimals = __decimals;
  }

  function mint(uint256 amount) public {
    _mint(msg.sender, amount);
  }

  function decimals() public view override returns (uint8) {
    return _decimals;
  }

}