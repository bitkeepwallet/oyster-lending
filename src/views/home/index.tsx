import { MintInfo } from "@solana/spl-token";
import { Card, Col, Row, Statistic } from "antd";
import React, { useEffect, useState } from "react";
import { LABELS } from "../../constants";
import { cache, ParsedAccount } from "../../contexts/accounts";
import { useConnectionConfig } from "../../contexts/connection";
import { useMarkets } from "../../contexts/market";
import { useLendingReserves } from "../../hooks";
import { reserveMarketCap } from "../../models";
import { fromLamports, getTokenName, wadToLamports } from "../../utils/utils";
import { LendingReserveItem } from "./item";
import { BarChartStatistic } from "./../../components/BarChartStatistic";
import "./itemStyle.less";

interface Totals {
  marketSize: number;
  borrowed: number;
  lentOutPct: number;
  items: {
    marketSize: number;
    borrowed: number;
    name: string;
  }[];
}

export const HomeView = () => {
  const { reserveAccounts } = useLendingReserves();
  const { marketEmitter, midPriceInUSD } = useMarkets();
  const { tokenMap } = useConnectionConfig();
  const [totals, setTotals] = useState<Totals>({
    marketSize: 0,
    borrowed: 0,
    lentOutPct: 0, 
    items: [],
  })

  useEffect(() => {
    const refreshTotal = () => {
      let newTotals: Totals = {
        marketSize: 0,
        borrowed: 0,
        lentOutPct: 0, 
        items: [],
      };

      reserveAccounts.forEach((item) => {
        const marketCapLamports = reserveMarketCap(item.info);

        const localCache = cache;
        const liquidityMint = localCache.get(
          item.info.liquidityMint.toBase58()
        ) as ParsedAccount<MintInfo>;

        if (!liquidityMint) {
          return;
        }

        let leaf = {
          marketSize: fromLamports(marketCapLamports, liquidityMint?.info) *
            midPriceInUSD(liquidityMint?.pubkey.toBase58()),
          borrowed: fromLamports(
            wadToLamports(item.info?.borrowedLiquidityWad).toNumber(),
            liquidityMint.info
          ),
          name: getTokenName(tokenMap, item.info.liquidityMint.toBase58())
        }

        newTotals.items.push(leaf);

        newTotals.marketSize = newTotals.marketSize + leaf.marketSize;
        newTotals.borrowed = newTotals.borrowed + leaf.borrowed;
        
      });

      newTotals.lentOutPct = newTotals.borrowed / newTotals.marketSize;
      newTotals.lentOutPct = Number.isFinite(newTotals.lentOutPct) ? newTotals.lentOutPct : 0;
      newTotals.items = newTotals.items.sort((a, b) => b.marketSize - a.marketSize)

      setTotals(newTotals);
    };

    const dispose = marketEmitter.onMarket(() => {
      refreshTotal();
    });

    refreshTotal();

    return () => {
      dispose();
    };
  }, [marketEmitter, midPriceInUSD, setTotals, reserveAccounts, tokenMap]);

  return (
    <div className="flexColumn">
      <Row 
        gutter={[16, { xs: 8, sm: 16, md: 16, lg: 16 }]} 
        className="home-info-row" >
        <Col xs={24} xl={5}>
          <Card>
            <Statistic
              title="Current market size"
              value={totals.marketSize}
              precision={2}
              valueStyle={{ color: "#3f8600" }}
              prefix="$"
            />
          </Card>
        </Col>
        <Col xs={24} xl={5}>
          <Card>
            <Statistic
              title="Total borrowed"
              value={totals.borrowed}
              precision={2}
              prefix="$"
            />
          </Card>
        </Col>
        <Col xs={24} xl={5}>
          <Card>
            <Statistic
              title="% Lent out"
              value={totals.lentOutPct * 100}
              precision={2}
              suffix="%"
            />
          </Card>
        </Col>
        <Col xs={24} xl={9}>
          <Card>
            <BarChartStatistic
              title="Market composition"
              name={(item) => item.name}
              getPct={(item) => item.marketSize / totals.marketSize}
              items={totals.items} />
          </Card>
        </Col>
      </Row>

      <div className="home-item home-header">
        <div>{LABELS.TABLE_TITLE_ASSET}</div>
        <div>{LABELS.TABLE_TITLE_MARKET_SIZE}</div>
        <div>{LABELS.TABLE_TITLE_TOTAL_BORROWED}</div>
        <div>{LABELS.TABLE_TITLE_DEPOSIT_APY}</div>
        <div>{LABELS.TABLE_TITLE_BORROW_APY}</div>
      </div>
      {reserveAccounts.map((account) => (
        <LendingReserveItem reserve={account.info} address={account.pubkey} />
      ))}
    </div>
  );
};