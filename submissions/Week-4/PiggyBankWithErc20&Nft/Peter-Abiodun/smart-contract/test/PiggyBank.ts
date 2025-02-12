import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import hre, {ethers as hardHatEthers} from "hardhat";
import { ethers, parseEther, parseUnits } from "ethers";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";


describe('PiggyBank', () => {

  const ADDRESS_ZERO = `0x0000000000000000000000000000000000000000`;

  const deployPiggyContract = async () => {

      const [owner, otherAccount] = await hre.ethers.getSigners();
      const initialSypply = parseUnits('1000', 18);

      const piggy = await hre.ethers.getContractFactory("PiggyBank");
      const peteToken = await hre.ethers.getContractFactory("PeteToken");
      const peteNFT = await hre.ethers.getContractFactory("PeteNFT");
      const deployedPeteToken = await peteToken.deploy(initialSypply);
      const deployedPeteNFT = await peteNFT.deploy();
      const deployedTokenAsSigner = deployedPeteToken.runner as HardhatEthersSigner;
      const deployedNFTAsSigner = deployedPeteNFT.runner as HardhatEthersSigner;
      const deployedPiggy = await piggy.deploy(deployedTokenAsSigner.address, deployedNFTAsSigner.address, 1000, Date.now() + (60 * 60), owner.address);

      console.log('token Address after deployment', deployedTokenAsSigner.address);
      

      let saveAmount = parseUnits("1", 18);

      return {initialSypply, deployedPiggy, owner, otherAccount, saveAmount, deployedPeteToken, deployedPeteNFT};
  }

  describe('deploy tokens', () => {
    it('should have the right token name and symbol', async () => {
      const {deployedPeteToken} = await loadFixture(deployPiggyContract);
      expect(await deployedPeteToken.name()).to.be.equal('Pete');
      expect(await deployedPeteToken.symbol()).to.be.equal('PETE');
    })
    it('should have the right NFT name and symbol', async () => {
      const {deployedPeteNFT} = await loadFixture(deployPiggyContract);
      expect(await deployedPeteNFT.name()).to.be.equal('Pete');
      expect(await deployedPeteNFT.symbol()).to.be.equal('PETE');
    })
    it('should have deployed Token with initial value of 1000', async () => {
      const {deployedPeteToken, owner, initialSypply} = await loadFixture(deployPiggyContract);
      expect(await deployedPeteToken.totalSupply()).to.be.equal(initialSypply);
      expect(await deployedPeteToken.balanceOf(owner.address)).to.be.equal(initialSypply);
    })
    it('should have deployed NFT with initial value of 1, belonging to owner', async () => {
      const {deployedPeteNFT, owner, otherAccount} = await loadFixture(deployPiggyContract);
      const balance = await deployedPeteNFT.balanceOf(owner.address);
      // console.log(owner.address, deployedPeteNFT.owner());
      expect(await deployedPeteNFT.balanceOf(owner.address)).to.be.equal(1);
      expect(await deployedPeteNFT.balanceOf(otherAccount.address)).to.be.equal(0);
      expect(await deployedPeteNFT.ownerOf(1)).to.be.not.equal(otherAccount.address);
    })
  })

  describe('deploy piggy', () => {

      it('should have a target amount greater than zero', async () => {
          const {deployedPiggy, owner, otherAccount} = await loadFixture(deployPiggyContract);

          expect(await deployedPiggy.targetAmount()).to.not.equal(0);
      })

      it('should not have a manager address of address zero', async () => {
          const {deployedPiggy, owner, otherAccount} = await loadFixture(deployPiggyContract);

          expect(await deployedPiggy.manager()).to.not.equal(ADDRESS_ZERO);


      })

      it('should have a withdrawal date in the future', async () => {
          const {deployedPiggy, owner, otherAccount} = await loadFixture(deployPiggyContract);

          expect(await deployedPiggy.withdrawalDate()).to.be.greaterThan(new Date("2000-03-25").getMilliseconds());


      })

  })

  describe('deposit', () => {
      it('should increase contributions', async () => {
          const {deployedPiggy, owner, otherAccount, saveAmount, deployedPeteToken} = await loadFixture(deployPiggyContract);
          const balance = await deployedPeteToken.connect(owner).balanceOf(owner.address);

          console.log(balance, saveAmount);
          
          expect(balance).to.be.greaterThanOrEqual(saveAmount);
          const signer = deployedPiggy.runner as HardhatEthersSigner;
          const tokenSigner = deployedPeteToken.runner as HardhatEthersSigner;

          console.log('token address when being used', tokenSigner.address);
          console.log('token address inside piggy bank', await deployedPiggy.peteTokenAddress());
          
          expect(await deployedPeteToken.connect(owner).approve(signer.address, saveAmount)).to.not.be.reverted;

          const allow = await deployedPeteToken.connect(owner).allowance(owner.address, signer.address);
          // console.log("ALLOW: ", allow);
          
          expect(allow).to.equal(saveAmount);

          const contributionsBeforeDeposit = deployedPiggy.contributorsCount;
          
          await deployedPiggy.connect(owner).save(saveAmount);
          const contributionsAfterDeposit = deployedPiggy.contributorsCount;
          await expect(deployedPiggy.connect(owner).save(saveAmount)).to.not.be.reverted;

          expect(contributionsBeforeDeposit).to.be.lessThan(contributionsAfterDeposit);
      })

  })
  describe('withdraw', () => {
      it('should revert with you wan thief error', async () => {
          const {deployedPiggy, owner, otherAccount, saveAmount} = await loadFixture(deployPiggyContract);

          await expect(deployedPiggy.connect(otherAccount).withdrawal())
          .to.be.revertedWith("YOU WAN THIEF ABI ?");
          
      })

      it('should revert with not yet time error', async () => {
        const {deployedPiggy, owner, otherAccount, saveAmount} = await loadFixture(deployPiggyContract);
        await expect(deployedPiggy.connect(owner).withdrawal())
        .to.be.revertedWith("NOT YET TIME");
      })

      it('should revert with TARGET AMOUNT NOT REACHED error', async () => {
        const { deployedPiggy, owner } = await loadFixture(deployPiggyContract);
    
        const newTimestamp = parseUnits(`${Math.floor(Date.now() / 1000) + (60*60*60)}`, 4);
        const wd = await deployedPiggy.withdrawalDate();
        console.log(wd, newTimestamp);
        
        
        // Increase the blockchain time to the new timestamp, and Mine a new block
        await time.setNextBlockTimestamp(newTimestamp);
        await hardHatEthers.provider.send("evm_mine", []);

        await deployedPiggy.connect(owner).withdrawal();
    
        await expect(deployedPiggy.connect(owner).withdrawal())
            .to.be.revertedWith("TARGET AMOUNT NOT REACHED");
    });

  })
})