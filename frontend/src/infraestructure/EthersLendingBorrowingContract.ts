import { ethers, Contract, formatUnits, parseUnits, Signer } from "ethers";
import { ILendingBorrowingContract } from "../application/contracts/ILendingBorrowingContract";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./../utils/LendingBorrowingContract";
import { BrowserProvider } from "ethers";
import { EventLog } from "ethers";
import { Events } from "../dto/events";
import { JsonRpcApiProvider } from "ethers";

export class EthersLendingBorrowingContract implements ILendingBorrowingContract {
  private contract: Contract;
  private contractJsonRPC: Contract;
  private providerRPC: JsonRpcApiProvider;

  constructor(provider: BrowserProvider | Signer) {
    this.contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    this.providerRPC = new ethers.JsonRpcProvider("https://go.getblock.io/53b994830ef14714902da3cfc3d6d956");
    this.contractJsonRPC = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, this.providerRPC);
  }

  async getAssetValueInUSD(token: string, amount: string): Promise<string> {
    const valueInUSD = await this.contract.getAssetValueInUSD(token, parseUnits(amount, 18));
    return formatUnits(valueInUSD, 18);
  }
  async collateralDeposited(user: string, token: string): Promise<string> {
    const amount = await this.contract.collateralDeposited(user, token);
    return formatUnits(amount, 18);
  }

  async depositCollateral(token: string, amount: string): Promise<void> {
    const tx = await this.contract.depositCollateral(token, parseUnits(amount, 18));
    await tx.wait();
  }

  async borrowAsset(token: string, amount: string, repaymentTimestamp: number): Promise<void> {
    const tx = await this.contract.borrowAsset(token, parseUnits(amount, 18), repaymentTimestamp);
    await tx.wait();
  }

  async withdrawCollateralDeposited(token: string): Promise<void> {
    const tx = await this.contract.withdrawCollateralDeposited(token);
    await tx.wait();
  }

  async repayLoan(token: string, amount: string): Promise<void> {
    const tx = await this.contract.repayLoan(token, parseUnits(amount, 18));
    await tx.wait();
  }

  async liquidatePosition(userToLiquidate: string, borrowedAsset: string, collateralAsset: string, amount: string): Promise<void> {
    const tx = await this.contract.liquidatePosition(userToLiquidate, borrowedAsset, collateralAsset, parseUnits(amount, 18));
    await tx.wait();
  }

  // 🔹 Consultas de usuario
  async getUserTotalBorrowed(user: string): Promise<string> {
    const amount = await this.contract.userTotalBorrowedAssetInUsd(user);
    return formatUnits(amount, 18);
  }

  async getUserTotalCollateral(user: string): Promise<string> {
    const amount = await this.contract.userTotalCollateralAssetInUsd(user);
    return formatUnits(amount, 18);
  }

  async allowedBorrowingAmount(user: string): Promise<string> {
    const amount = await this.contract.allowedBorrowingAmount(user);
    return formatUnits(amount, 18);
  }

  async checkForBrokenHealthFactor(user: string): Promise<boolean> {
    try {
      await this.contract.checkForBrokenHealthFactor(user);
      return true;
    } catch {
      return false;
    }
  }

  async userHealthFactor(user: string): Promise<string> {
    try {
      const healthFactor = await this.contract.userHealthFactor(user);
      return formatUnits(healthFactor, 18);
    } catch (error) {
      console.error("Error en userHealthFactor:", error);
      return "0";
    }
  }


  // 🔹 Gestión de liquidez
  async addLiquidity(token: string, amount: string, withdrawalTime: number): Promise<void> {
    const tx = await this.contract.addLiquidity(token, parseUnits(amount, 18), withdrawalTime);
    await tx.wait();
  }

  async withdrawFromLiquidityPool(token: string): Promise<void> {
    const tx = await this.contract.withdrawFromLiquidityPool(token);
    await tx.wait();
  }

  async totalLiquidity(token: string): Promise<string> {
    const amount = await this.contract.totalLiquidity(token);
    return formatUnits(amount, 18);
  }

  async calculateBasicLPRewards(token: string): Promise<string> {
    const rewards = await this.contract.calculateBasicLPRewards(token);
    return formatUnits(rewards, 18);
  }

  async getLiquidityPool(user: string, token: string): Promise<{ amount: string; withdrawalTime: number; addedAt: number }> {
    const liquidity = await this.contract.liquidityPool(user, token);
    return {
      amount: formatUnits(liquidity.amount, 18),
      withdrawalTime: Number(formatUnits(liquidity.withdrawalTime, 0)),
      addedAt: Number(formatUnits(liquidity.addedAt, 0)),
    };
  }

  // 🔹 Rebalanceo y tesorería
  async rebalancePortfolio(swapFrom: string, swapTo: string, amount: string): Promise<void> {
    const tx = await this.contract.rebalancePortfolio(swapFrom, swapTo, parseUnits(amount, 18));
    await tx.wait();
  }

  async treasury(token: string): Promise<string> {
    const amount = await this.contract.treasury(token);
    return formatUnits(amount, 18);
  }

  // 🔹 Información general
  async getTotalValueLocked(token: string): Promise<string> {
    const value = await this.contract.tvl(token);
    return formatUnits(value, 18);
  }

  async priceFeeds(token: string): Promise<string> {
    return await this.contract.priceFeeds(token);
  }

  // 🔹 Gestión de propiedad
  async transferOwnership(newOwner: string): Promise<void> {
    const tx = await this.contract.transferOwnership(newOwner);
    await tx.wait();
  }

  async acceptOwnership(): Promise<void> {
    const tx = await this.contract.acceptOwnership();
    await tx.wait();
  }

  // filters
  async queryFilterEventByAccount(acount: string, eventName: string, fromBlock: number, toBlock: number | string = 'latest'): Promise<Events[]> {
    const filters = this.contractJsonRPC.filters[eventName](acount);
    const events: EventLog[] = await this.contractJsonRPC.queryFilter(filters, fromBlock, toBlock) as EventLog[];

    const parsedEvent = events.map((log) => {
      try {
        const parsedLog = this.contractJsonRPC.interface.parseLog(log);
        if (!parsedLog) {
          console.warn("⚠️ Unable to parse log:", log);
          return null;
        }

        const { args } = parsedLog;
        const user: string = args.user;
        const token: string = args.token;
        const amount: bigint = args.amount;
        const timeStamp: bigint = args.timeStamp;

        const formattedDate = Number(timeStamp) * 1000;

        const formattedAmount = formatUnits(amount, 18);

        return {
          user,
          token,
          amount: formattedAmount,
          timeStamp: formattedDate,
          eventName
        }
      } catch (error) {
        console.error('error to process event', error);
        return null
      }
    }).filter((event) => event !== null);

    return parsedEvent;
  }

  getLastBlock(): Promise<number> {
    return this.providerRPC.getBlockNumber();
  }



}
