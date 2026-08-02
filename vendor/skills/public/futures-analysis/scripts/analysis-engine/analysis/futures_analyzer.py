#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
股指期货数据获取与分析模块

基于 Tushare Pro API 获取股指期货行情、持仓、基差数据，
并提供综合分析评分。

提供:
  - FuturesDataFetcher: 数据采集（行情K线、主力合约、机构持仓）
  - FuturesAnalyzer: 综合分析（趋势、基差、持仓信号、评分）
"""

import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

import pandas as pd

# 金融数据网关初始化（走 kk_common，不直接 import tushare）
try:
    from kk_common import get_finance_data_gateway
    pro = get_finance_data_gateway()
except Exception:
    pro = None


# 品种代码映射: 简称 → Tushare 合约前缀
SYMBOL_MAP = {
    'IF': {'name': '沪深300股指期货', 'code_prefix': 'IF', 'index': '000300.SH'},
    'IC': {'name': '中证500股指期货', 'code_prefix': 'IC', 'index': '000905.SH'},
    'IH': {'name': '上证50股指期货', 'code_prefix': 'IH', 'index': '000016.SH'},
    'IM': {'name': '中证1000股指期货', 'code_prefix': 'IM', 'index': '000852.SH'},
}


class FuturesDataFetcher:
    """股指期货数据采集器"""

    def __init__(self):
        self.pro = pro

    def get_dominant_contract(self, symbol: str) -> Optional[str]:
        """获取主力合约代码

        fut_mapping 返回全市场合约映射（ts_code 为连续合约代码，如 IFL2.CFX；
        mapping_ts_code 为该品种主力映射合约，如 IF2609.CFX），且不按 symbol
        过滤，因此需按品种前缀过滤后取最新交易日映射。
        """
        if not self.pro:
            return None
        try:
            df = self.pro.fut_mapping(symbol=symbol)
            if df is not None and not df.empty and 'mapping_ts_code' in df.columns:
                filtered = df[df['ts_code'].astype(str).str.startswith(symbol)]
                if not filtered.empty:
                    latest = filtered.sort_values('trade_date').iloc[-1]
                    code = latest.get('mapping_ts_code')
                    if code:
                        return str(code)
        except Exception:
            pass
        # Fallback: construct a plausible contract
        year = datetime.now().year
        month = datetime.now().month
        next_month = month + 1 if month < 12 else 1
        next_year = year if month < 12 else year + 1
        return f"{symbol}{str(next_year)[-2:]}{next_month:02d}"

    def get_daily_bars(self, ts_code: str, days: int = 30) -> pd.DataFrame:
        """获取日线行情"""
        if not self.pro:
            return pd.DataFrame()
        end_date = datetime.now().strftime('%Y%m%d')
        start_date = (datetime.now() - timedelta(days=days * 2)).strftime('%Y%m%d')
        try:
            df = self.pro.fut_daily(ts_code=ts_code,
                                    start_date=start_date, end_date=end_date)
            if df is not None and not df.empty:
                return df.sort_values('trade_date').reset_index(drop=True)
        except Exception:
            pass
        # Try without ts_code (get all then filter)
        try:
            df = self.pro.fut_daily(start_date=start_date, end_date=end_date)
            if df is not None and not df.empty:
                filtered = df[df['ts_code'].str.startswith(ts_code[:2])]
                if not filtered.empty:
                    return filtered.sort_values('trade_date').reset_index(drop=True)
        except Exception:
            pass
        return pd.DataFrame()

    def get_index_data(self, index_code: str, days: int = 30) -> pd.DataFrame:
        """获取现货指数数据"""
        if not self.pro:
            return pd.DataFrame()
        end_date = datetime.now().strftime('%Y%m%d')
        start_date = (datetime.now() - timedelta(days=days * 2)).strftime('%Y%m%d')
        try:
            df = self.pro.index_daily(ts_code=index_code,
                                      start_date=start_date, end_date=end_date)
            if df is not None and not df.empty:
                return df.sort_values('trade_date').reset_index(drop=True)
        except Exception:
            pass
        return pd.DataFrame()

    def get_holding_data(self, ts_code: str) -> pd.DataFrame:
        """获取机构持仓数据

        fut_holding 的 symbol 参数为短格式（如 IF2703），需去除交易所后缀。
        """
        if not self.pro:
            return pd.DataFrame()
        symbol = ts_code.split('.')[0]
        try:
            today = datetime.now().strftime('%Y%m%d')
            df = self.pro.fut_holding(symbol=symbol, trade_date=today)
            if df is not None and not df.empty:
                return df
        except Exception:
            pass
        # Try previous trading day
        for i in range(1, 7):
            prev = (datetime.now() - timedelta(days=i)).strftime('%Y%m%d')
            try:
                df = self.pro.fut_holding(symbol=symbol, trade_date=prev)
                if df is not None and not df.empty:
                    return df
            except Exception:
                continue
        return pd.DataFrame()


class FuturesAnalyzer:
    """股指期货综合分析器"""

    def __init__(self, fetcher: FuturesDataFetcher):
        self.fetcher = fetcher

    def analyze_all(self, symbols: List[str] = None, days: int = 30) -> Dict[str, Any]:
        """
        全量分析

        Returns:
            {
                'symbols': {symbol: {'contracts':..., 'price':..., 'contango':..., 'holding':...}},
                'composite': {'avg_score':..., 'market_env':..., 'details':...}
            }
        """
        if symbols is None:
            symbols = ['IF', 'IC', 'IH', 'IM']

        all_symbols = {}
        details = {}
        scores = {}

        for sym in symbols:
            sym_info = SYMBOL_MAP.get(sym, {})
            sym_data = self._analyze_symbol(sym, sym_info, days)
            if sym_data:
                all_symbols[sym] = sym_data
                score, detail = self._score_symbol(sym_data)
                scores[sym] = score
                details[sym] = detail

        avg_score = sum(scores.values()) / len(scores) if scores else 50
        market_env = self._market_environment(avg_score)

        return {
            'symbols': all_symbols,
            'composite': {
                'avg_score': round(avg_score, 1),
                'market_env': market_env,
                'symbol_scores': scores,
                'details': details,
                'suggestions': self._generate_suggestions(avg_score, details),
                'divergence_signal': self._divergence_signal(scores),
            }
        }

    def _analyze_symbol(self, sym: str, sym_info: dict, days: int) -> Dict[str, Any]:
        """分析单个品种"""
        result = {'contracts': {}, 'price': {}, 'contango': {}, 'holding': {}}

        # 获取主力合约
        main_contract = self.fetcher.get_dominant_contract(sym)
        result['contracts'] = {
            'main_contract': main_contract or f'{sym}主力',
            'contracts': [main_contract] if main_contract else [],
        }

        # 行情数据（fut_daily 需完整合约代码，如 IF2609.CFX）
        prefix = sym_info.get('code_prefix', sym)
        bars = self.fetcher.get_daily_bars(main_contract or prefix, days)
        if bars is not None and not bars.empty:
            result['price'] = self._analyze_price(bars)

        # 基差数据
        index_code = sym_info.get('index', '')
        if index_code:
            index_df = self.fetcher.get_index_data(index_code, days)
            if index_df is not None and not index_df.empty:
                result['contango'] = self._analyze_contango(bars, index_df)

        # 持仓数据
        if main_contract:
            holding = self.fetcher.get_holding_data(main_contract)
            if holding is not None and not holding.empty:
                result['holding'] = self._analyze_holding(holding)

        return result

    def _analyze_price(self, df: pd.DataFrame) -> Dict[str, Any]:
        """分析价格趋势"""
        if df.empty:
            return {}

        latest = df.iloc[-1]
        close = float(latest.get('close', 0))
        settle = float(latest.get('settle', close))
        pre_settle = float(latest.get('pre_settle', close))
        pct_chg = float(latest.get('pct_chg', 0))
        vol = int(float(latest.get('vol', 0)))
        oi = int(float(latest.get('oi', 0)))

        # 均线
        closes = df['close'].astype(float)
        ma5 = float(closes.tail(5).mean()) if len(closes) >= 5 else close
        ma10 = float(closes.tail(10).mean()) if len(closes) >= 10 else close
        ma20 = float(closes.tail(20).mean()) if len(closes) >= 20 else close

        # 趋势判断
        if close > ma5 > ma10 > ma20:
            trend = '多头排列'
        elif close < ma5 < ma10 < ma20:
            trend = '空头排列'
        elif close > ma5:
            trend = '偏多震荡'
        else:
            trend = '偏空震荡'

        # 振幅
        high20 = float(df['high'].astype(float).tail(20).max()) if len(df) >= 20 else float(df['high'].astype(float).max())
        low20 = float(df['low'].astype(float).tail(20).min()) if len(df) >= 20 else float(df['low'].astype(float).min())
        avg_amp = float(((df['high'].astype(float) - df['low'].astype(float)) / df['close'].astype(float).replace(0, float('nan'))).tail(10).mean() * 100) if len(df) >= 10 else 0

        # OI 变化
        oi_chg = int(float(latest.get('oi_chg', 0)))
        vol_5d = int(df['vol'].astype(float).tail(5).mean()) if len(df) >= 5 else vol

        # 历史数据（用于图表）
        history = []
        for _, row in df.tail(30).iterrows():
            history.append({
                'date': str(row.get('trade_date', '')),
                'close': float(row.get('close', 0)),
                'vol': int(float(row.get('vol', 0))),
                'oi': int(float(row.get('oi', 0))),
            })

        return {
            'latest_date': str(latest.get('trade_date', '-')),
            'close': close,
            'settle': settle,
            'pct_chg': pct_chg,
            'ma5': round(ma5, 1),
            'ma10': round(ma10, 1),
            'ma20': round(ma20, 1),
            'trend': trend,
            'high20': round(high20, 1),
            'low20': round(low20, 1),
            'avg_amplitude_10d': round(avg_amp, 2),
            'oi': oi,
            'oi_chg': oi_chg,
            'oi_trend': '增仓' if oi_chg > 0 else '减仓' if oi_chg < 0 else '持平',
            'vol': vol,
            'vol_5d_avg': vol_5d,
            'vol_signal': '放量' if vol > vol_5d * 1.2 else '缩量' if vol < vol_5d * 0.8 else '正常',
            'history': history,
        }

    def _analyze_contango(self, fut_df: pd.DataFrame, index_df: pd.DataFrame) -> Dict[str, Any]:
        """分析基差/贴升水"""
        if fut_df.empty or index_df.empty:
            return {}

        fut_close = float(fut_df.iloc[-1].get('close', 0))
        spot_close = float(index_df.iloc[-1].get('close', 0))

        if spot_close == 0:
            return {}

        basis = fut_close - spot_close
        basis_rate = (basis / spot_close) * 100

        if basis_rate > 0.5:
            sentiment = '升水（偏多预期）'
        elif basis_rate < -0.5:
            sentiment = '贴水（偏空预期）'
        else:
            sentiment = '基差正常'

        return {
            'spot_price': round(spot_close, 1),
            'futures_price': round(fut_close, 1),
            'near_basis': round(basis, 1),
            'near_basis_rate': round(basis_rate, 2),
            'avg_basis_rate': round(basis_rate, 2),
            'sentiment': sentiment,
        }

    def _analyze_holding(self, df: pd.DataFrame) -> Dict[str, Any]:
        """分析机构持仓

        Tushare fut_holding 字段：broker / long_hld / short_hld / long_chg / short_chg。
        输出结构对齐 analyze_futures.py 的打印格式（top10_long/top10_short 席位明细、
        中信 vs 其他机构汇总与信号）。
        """
        if df.empty:
            return {}

        result = {
            'top10_long': [],
            'top10_short': [],
            'citic_signal': '-',
            'position_signal': '-',
            'chg_signal': '-',
            'total_long': 0, 'total_short': 0,
            'net_position': 0, 'net_chg': 0, 'ls_ratio': 0.0,
            'citic_long': 0, 'citic_short': 0, 'citic_net': 0, 'citic_net_chg': 0,
            'others_long': 0, 'others_short': 0, 'others_net': 0, 'others_net_chg': 0,
            'others_signal': '-', 'citic_vs_others_signal': '-',
        }

        try:
            # 字段兼容：旧列名 long_vol/short_vol 与新列名 long_hld/short_hld
            def pick(*names):
                for n in names:
                    if n in df.columns:
                        return n
                return None

            long_c = pick('long_vol', 'long_hld')
            short_c = pick('short_vol', 'short_hld')
            long_chg_c = pick('long_chg')
            short_chg_c = pick('short_chg')

            if long_c and short_c:
                valid = df.dropna(subset=[long_c, short_c])
                total_long = float(valid[long_c].sum())
                total_short = float(valid[short_c].sum())
                net = total_long - total_short
                result['total_long'] = int(total_long)
                result['total_short'] = int(total_short)
                result['net_position'] = int(net)
                result['ls_ratio'] = round(total_long / total_short, 3) if total_short else 0.0
                if total_long > total_short * 1.05:
                    result['position_signal'] = '净多头（偏多）'
                elif total_short > total_long * 1.05:
                    result['position_signal'] = '净空头（偏空）'
                else:
                    result['position_signal'] = '多空均衡'

                # 当日多空单变化信号
                if long_chg_c and short_chg_c:
                    net_chg = float(valid[long_chg_c].sum()) - float(valid[short_chg_c].sum())
                    result['net_chg'] = int(net_chg)
                    if net_chg > 0:
                        result['chg_signal'] = '净增仓'
                    elif net_chg < 0:
                        result['chg_signal'] = '净减仓'
                    else:
                        result['chg_signal'] = '持平'

                # 多头/空头前 10 席位
                top_long = valid.nlargest(10, long_c)
                top_short = valid.nlargest(10, short_c)
                result['top10_long'] = [
                    {'broker': str(r.get('broker', '-')),
                     'long_hld': int(float(r.get(long_c, 0))),
                     'long_chg': int(float(r.get(long_chg_c, 0))) if long_chg_c else 0}
                    for _, r in top_long.iterrows()
                ]
                result['top10_short'] = [
                    {'broker': str(r.get('broker', '-')),
                     'short_hld': int(float(r.get(short_c, 0))),
                     'short_chg': int(float(r.get(short_chg_c, 0))) if short_chg_c else 0}
                    for _, r in top_short.iterrows()
                ]

                # 中信期货信号（净持仓 + 当日净变化）
                if 'broker' in df.columns:
                    citic = df[df['broker'].astype(str).str.contains('中信', na=False)]
                    if not citic.empty:
                        citic_row = citic.iloc[0]
                        c_long = float(citic_row.get(long_c, 0) or 0)
                        c_short = float(citic_row.get(short_c, 0) or 0)
                        c_net = c_long - c_short
                        c_net_chg = (float(citic_row.get(long_chg_c, 0) or 0)
                                     - float(citic_row.get(short_chg_c, 0) or 0)) if long_chg_c and short_chg_c else 0
                        result['citic_long'] = int(c_long)
                        result['citic_short'] = int(c_short)
                        result['citic_net'] = int(c_net)
                        result['citic_net_chg'] = int(c_net_chg)
                        result['citic_signal'] = '偏多' if c_net > 0 else '偏空' if c_net < 0 else '中性'

                        # 其他十九家 = 总量 - 中信
                        others_long = total_long - c_long
                        others_short = total_short - c_short
                        result['others_long'] = int(others_long)
                        result['others_short'] = int(others_short)
                        result['others_net'] = int(others_long - others_short)
                        result['others_net_chg'] = int(result['net_chg'] - c_net_chg)
                        result['others_signal'] = ('偏多' if others_long > others_short else
                                                   '偏空' if others_short > others_long else '中性')

                        # 中信 vs 其他：比较净持仓方向
                        if c_net > 0 and (others_long - others_short) > 0:
                            result['citic_vs_others_signal'] = '同向做多'
                        elif c_net < 0 and (others_long - others_short) < 0:
                            result['citic_vs_others_signal'] = '同向做空'
                        elif c_net == 0 and (others_long - others_short) == 0:
                            result['citic_vs_others_signal'] = '均中性'
                        else:
                            result['citic_vs_others_signal'] = '方向分歧'
        except Exception:
            pass

        return result

    def _score_symbol(self, sym_data: dict) -> tuple:
        """评分单个品种"""
        score = 50
        detail = {'trend': '-', 'sentiment': '-', 'position_signal': '-',
                  'citic_signal': '-', 'citic_vs_others_signal': '-'}

        price = sym_data.get('price', {})
        if price:
            detail['trend'] = price.get('trend', '-')
            if '多头' in detail['trend']:
                score += 15
            elif '空头' in detail['trend']:
                score -= 15
            if price.get('pct_chg', 0) > 0:
                score += 5
            elif price.get('pct_chg', 0) < 0:
                score -= 5

        contango = sym_data.get('contango', {})
        if contango:
            detail['sentiment'] = contango.get('sentiment', '-')
            if '升水' in detail['sentiment']:
                score += 10
            elif '贴水' in detail['sentiment']:
                score -= 10

        holding = sym_data.get('holding', {})
        if holding:
            detail['position_signal'] = holding.get('position_signal', '-')
            detail['citic_signal'] = holding.get('citic_signal', '-')
            if '偏多' in detail['position_signal']:
                score += 10
            elif '偏空' in detail['position_signal']:
                score -= 10
            if detail['citic_signal'] == '偏多':
                score += 5
            elif detail['citic_signal'] == '偏空':
                score -= 5

        score = max(0, min(100, score))
        return score, detail

    def _market_environment(self, avg_score: float) -> str:
        if avg_score >= 65:
            return '偏多'
        elif avg_score <= 35:
            return '偏空'
        else:
            return '中性'

    def _divergence_signal(self, scores: dict) -> str:
        if not scores:
            return '-'
        max_s = max(scores.values())
        min_s = min(scores.values())
        diff = max_s - min_s
        if diff > 25:
            return f'品种分化明显（差值{diff}）'
        elif diff > 10:
            return f'品种略有分化（差值{diff}）'
        return f'品种走势一致（差值{diff}）'

    def _generate_suggestions(self, avg_score: float, details: dict) -> List[str]:
        suggestions = []
        if avg_score >= 65:
            suggestions.append('市场情绪偏多，可关注做多机会')
        elif avg_score <= 35:
            suggestions.append('市场情绪偏空，注意风险控制')
        else:
            suggestions.append('市场情绪中性，建议观望')

        for sym, d in details.items():
            if d.get('citic_signal') == '偏空':
                suggestions.append(f'{sym}：中信持仓偏空，注意风险')
            if '贴水' in d.get('sentiment', ''):
                suggestions.append(f'{sym}：基差贴水，市场预期偏空')

        return suggestions
