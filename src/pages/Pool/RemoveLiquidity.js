import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import ReactGA from 'react-ga'
import { createBrowserHistory } from 'history'
import { ethers } from 'ethers'
import styled from 'styled-components'

import { useWeb3React, useExchangeContract } from '../../hooks'
import { useTransactionAdder } from '../../contexts/Transactions'
import { useTokenDetails, INITIAL_TOKENS_CONTEXT } from '../../contexts/Tokens'
import { useAddressBalance } from '../../contexts/Balances'

import { calculateGasMargin, amountFormatter } from '../../utils'
import { brokenTokens } from '../../constants'

import { Button } from '../../theme'
import CurrencyInputPanel from '../../components/CurrencyInputPanel'
import ContextualInfo from '../../components/ContextualInfo'
import OversizedPanel from '../../components/OversizedPanel'
import ArrowDown from '../../assets/svg/SVGArrowDown'
import WarningCard from '../../components/WarningCard'

// denominated in bips
const ALLOWED_SLIPPAGE = ethers.utils.bigNumberify(200)

// denominated in seconds
const DEADLINE_FROM_NOW = 60 * 15

// denominated in bips
const GAS_MARGIN = ethers.utils.bigNumberify(1000)

const BlueSpan = styled.span`
  color: ${({ theme }) => theme.royalBlue};
`

const DownArrowBackground = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  justify-content: center;
  align-items: center;
`

const DownArrow = styled(ArrowDown)`
  ${({ theme }) => theme.flexRowNoWrap}
  color: ${({ theme, active }) => (active ? theme.royalBlue : theme.doveGray)};
  width: 0.625rem;
  height: 0.625rem;
  position: relative;
  padding: 0.875rem;
`

const RemoveLiquidityOutput = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  min-height: 3.5rem;
`

const RemoveLiquidityOutputText = styled.div`
  font-size: 1.25rem;
  line-height: 1.5rem;
  padding: 1rem 0.75rem;
`

const RemoveLiquidityOutputPlus = styled.div`
  font-size: 1.25rem;
  line-height: 1.5rem;
  padding: 1rem 0;
`

const SummaryPanel = styled.div`
  ${({ theme }) => theme.flexColumnNoWrap}
  padding: 1rem 0;
`

const LastSummaryText = styled.div`
  margin-top: 1rem;
`

const ExchangeRateWrapper = styled.div`
  ${({ theme }) => theme.flexRowNoWrap};
  align-items: center;
  color: ${({ theme }) => theme.doveGray};
  font-size: 0.75rem;
  padding: 0.25rem 1rem 0;
`

const ExchangeRate = styled.span`
  flex: 1 1 auto;
  width: 0;
  color: ${({ theme }) => theme.doveGray};
`

const Flex = styled.div`
  display: flex;
  justify-content: center;
  padding: 2rem;

  button {
    max-width: 20rem;
  }
`

function getExchangeRate(inputValue, inputDecimals, outputValue, outputDecimals, invert = false) {
  try {
    if (
      inputValue &&
      (inputDecimals || inputDecimals === 0) &&
      outputValue &&
      (outputDecimals || outputDecimals === 0)
    ) {
      const factor = ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(18))

      if (invert) {
        return inputValue
          .mul(factor)
          .mul(ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(outputDecimals)))
          .div(ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(inputDecimals)))
          .div(outputValue)
      } else {
        return outputValue
          .mul(factor)
          .mul(ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(inputDecimals)))
          .div(ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(outputDecimals)))
          .div(inputValue)
      }
    }
  } catch {}
}

function getMarketRate(reserveETH, reserveToken, decimals, invert = false) {
  return getExchangeRate(reserveETH, 18, reserveToken, decimals, invert)
}

function calculateSlippageBounds(value) {
  if (value) {
    const offset = value.mul(ALLOWED_SLIPPAGE).div(ethers.utils.bigNumberify(10000))
    const minimum = value.sub(offset)
    const maximum = value.add(offset)
    return {
      minimum: minimum.lt(ethers.constants.Zero) ? ethers.constants.Zero : minimum,
      maximum: maximum.gt(ethers.constants.MaxUint256) ? ethers.constants.MaxUint256 : maximum
    }
  } else {
    return {}
  }
}

export default function RemoveLiquidity({ params }) {
  const { t } = useTranslation()
  const { library, account, active, chainId } = useWeb3React()

  const addTransaction = useTransactionAdder()

  const [brokenTokenWarning, setBrokenTokenWarning] = useState()

  // clear url of query
  useEffect(() => {
    const history = createBrowserHistory()
    history.push(window.location.pathname + '')
  }, [])

  const [outputCurrency, setOutputCurrency] = useState(params.poolTokenAddress)
  const [value, setValue] = useState(params.poolTokenAmount ? params.poolTokenAmount : '')
  const [inputError, setInputError] = useState()
  const [valueParsed, setValueParsed] = useState()

  useEffect(() => {
    setBrokenTokenWarning(false)
    for (let i = 0; i < brokenTokens.length; i++) {
      if (brokenTokens[i].toLowerCase() === outputCurrency.toLowerCase()) {
        setBrokenTokenWarning(true)
      }
    }
  }, [outputCurrency])

  // parse value
  useEffect(() => {
    try {
      const parsedValue = ethers.utils.parseUnits(value, 18)
      setValueParsed(parsedValue)
    } catch {
      if (value !== '') {
        setInputError(t('inputNotValid'))
      }
    }

    return () => {
      setInputError()
      setValueParsed()
    }
  }, [t, value])

  const { symbol, decimals, exchangeAddress } = useTokenDetails(outputCurrency)

  const [totalPoolTokens, setTotalPoolTokens] = useState()
  const poolTokenBalance = useAddressBalance(account, exchangeAddress)
  const exchangeETHBalance = useAddressBalance(exchangeAddress, 'ETH')
  const exchangeTokenBalance = useAddressBalance(exchangeAddress, outputCurrency)

  const urlAddedTokens = {}
  if (params.poolTokenAddress) {
    urlAddedTokens[params.poolTokenAddress] = true
  }

  // input validation
  useEffect(() => {
    if (valueParsed && poolTokenBalance) {
      if (valueParsed.gt(poolTokenBalance)) {
        setInputError(t('insufficientBalance'))
      } else {
        setInputError(null)
      }
    }
  }, [poolTokenBalance, t, valueParsed])

  const exchange = useExchangeContract(exchangeAddress)

  const ownershipPercentage =
    poolTokenBalance && totalPoolTokens && !totalPoolTokens.isZero()
      ? poolTokenBalance.mul(ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(18))).div(totalPoolTokens)
      : undefined
  const ownershipPercentageFormatted = ownershipPercentage && amountFormatter(ownershipPercentage, 16, 4)

  const ETHOwnShare =
    exchangeETHBalance &&
    ownershipPercentage &&
    exchangeETHBalance.mul(ownershipPercentage).div(ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(18)))
  const TokenOwnShare =
    exchangeTokenBalance &&
    ownershipPercentage &&
    exchangeTokenBalance.mul(ownershipPercentage).div(ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(18)))

  const ETHPer = exchangeETHBalance
    ? exchangeETHBalance.mul(ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(18)))
    : undefined
  const tokenPer = exchangeTokenBalance
    ? exchangeTokenBalance.mul(ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(18)))
    : undefined

  const ethWithdrawn =
    ETHPer && valueParsed && totalPoolTokens && !totalPoolTokens.isZero()
      ? ETHPer.mul(valueParsed)
          .div(ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(18)))
          .div(totalPoolTokens)
      : undefined
  const tokenWithdrawn =
    tokenPer && valueParsed && totalPoolTokens && !totalPoolTokens.isZero()
      ? tokenPer
          .mul(valueParsed)
          .div(ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(18)))
          .div(totalPoolTokens)
      : undefined

  const ethWithdrawnMin = ethWithdrawn ? calculateSlippageBounds(ethWithdrawn).minimum : undefined
  const tokenWithdrawnMin = tokenWithdrawn ? calculateSlippageBounds(tokenWithdrawn).minimum : undefined

  const fetchPoolTokens = useCallback(() => {
    if (exchange) {
      exchange.totalSupply().then(totalSupply => {
        setTotalPoolTokens(totalSupply)
      })
    }
  }, [exchange])
  useEffect(() => {
    fetchPoolTokens()
    library.on('block', fetchPoolTokens)

    return () => {
      library.removeListener('block', fetchPoolTokens)
    }
  }, [fetchPoolTokens, library])

  async function onRemoveLiquidity() {
    // take ETH amount, multiplied by ETH rate and 2 for total tx size
    let ethTransactionSize = (ethWithdrawn / 1e18) * 2

    const deadline = Math.ceil(Date.now() / 1000) + DEADLINE_FROM_NOW

    const estimatedGasLimit = await exchange.estimate.removeLiquidity(
      valueParsed,
      ethWithdrawnMin,
      tokenWithdrawnMin,
      deadline
    )

    exchange
      .removeLiquidity(valueParsed, ethWithdrawnMin, tokenWithdrawnMin, deadline, {
        gasLimit: calculateGasMargin(estimatedGasLimit, GAS_MARGIN)
      })
      .then(response => {
        ReactGA.event({
          category: 'Transaction',
          action: 'Remove Liquidity',
          label: outputCurrency,
          value: ethTransactionSize,
          dimension1: response.hash
        })
        ReactGA.event({
          category: 'Hash',
          action: response.hash,
          label: ethTransactionSize.toString(),
          value: ethTransactionSize
        })
        addTransaction(response)
      })
  }

  const b = text => <BlueSpan>{text}</BlueSpan>

  function renderTransactionDetails() {
    return (
      <div>
        <div>
          {t('youAreRemoving')} {b(`${amountFormatter(ethWithdrawn, 18, 4)} BST`)} {t('and')}{' '}
          {b(`${amountFormatter(tokenWithdrawn, decimals, Math.min(decimals, 4))} ${symbol}`)} {t('outPool')}
        </div>
        <LastSummaryText>
          {t('youWillRemove')} {b(amountFormatter(valueParsed, 18, 4))} {t('liquidityTokens')}
        </LastSummaryText>
        <LastSummaryText>
          {t('totalSupplyIs')} {b(amountFormatter(totalPoolTokens, 18, 4))}
        </LastSummaryText>
        <LastSummaryText>
          {t('tokenWorth')} {b(amountFormatter(ETHPer.div(totalPoolTokens), 18, 4))} BST {t('and')}{' '}
          {b(amountFormatter(tokenPer.div(totalPoolTokens), decimals, Math.min(4, decimals)))} {symbol}
        </LastSummaryText>
      </div>
    )
  }

  function renderSummary() {
    let contextualInfo = ''
    let isError = false
    if (brokenTokenWarning) {
      contextualInfo = t('brokenToken')
      isError = true
    } else if (inputError) {
      contextualInfo = inputError
      isError = true
    } else if (!outputCurrency || outputCurrency === 'ETH') {
      contextualInfo = t('selectTokenCont')
    } else if (!valueParsed) {
      contextualInfo = t('enterValueCont')
    } else if (!account) {
      contextualInfo = t('noWallet')
      isError = true
    }

    return (
      <ContextualInfo
        key="context-info"
        openDetailsText={t('transactionDetails')}
        closeDetailsText={t('hideDetails')}
        contextualInfo={contextualInfo}
        isError={isError}
        renderTransactionDetails={renderTransactionDetails}
      />
    )
  }

  function formatBalance(value) {
    return `Balance: ${value}`
  }

  const isActive = active && account
  const isValid = inputError === null

  const marketRate = getMarketRate(exchangeETHBalance, exchangeTokenBalance, decimals)

  const newOutputDetected =
    outputCurrency !== 'ETH' && outputCurrency && !INITIAL_TOKENS_CONTEXT[chainId].hasOwnProperty(outputCurrency)

  const [showCustomTokenWarning, setShowCustomTokenWarning] = useState(false)

  useEffect(() => {
    if (newOutputDetected) {
      setShowCustomTokenWarning(true)
    } else {
      setShowCustomTokenWarning(false)
    }
  }, [newOutputDetected])

  return (
    <>
      {showCustomTokenWarning && (
        <WarningCard
          onDismiss={() => {
            setShowCustomTokenWarning(false)
          }}
          urlAddedTokens={urlAddedTokens}
          currency={outputCurrency}
        />
      )}
      <CurrencyInputPanel
        title={t('poolTokens')}
        extraText={poolTokenBalance && formatBalance(amountFormatter(poolTokenBalance, 18, 4))}
        extraTextClickHander={() => {
          if (poolTokenBalance) {
            const valueToSet = poolTokenBalance
            if (valueToSet.gt(ethers.constants.Zero)) {
              setValue(amountFormatter(valueToSet, 18, 18, false))
            }
          }
        }}
        urlAddedTokens={urlAddedTokens}
        onCurrencySelected={setOutputCurrency}
        onValueChange={setValue}
        value={value}
        errorMessage={inputError}
        selectedTokenAddress={outputCurrency}
        hideETH={true}
      />
      <OversizedPanel>
        <DownArrowBackground>
          <DownArrow active={isActive} alt="arrow" />
        </DownArrowBackground>
      </OversizedPanel>
      <CurrencyInputPanel
        title={t('output')}
        description={!!(ethWithdrawn && tokenWithdrawn) ? `(${t('estimated')})` : ''}
        key="remove-liquidity-input"
        renderInput={() =>
          !!(ethWithdrawn && tokenWithdrawn) ? (
            <RemoveLiquidityOutput>
              <RemoveLiquidityOutputText>
                {`${amountFormatter(ethWithdrawn, 18, 4, false)} BST`}
              </RemoveLiquidityOutputText>
              <RemoveLiquidityOutputPlus> + </RemoveLiquidityOutputPlus>
              <RemoveLiquidityOutputText>
                {`${amountFormatter(tokenWithdrawn, decimals, Math.min(4, decimals))} ${symbol}`}
              </RemoveLiquidityOutputText>
            </RemoveLiquidityOutput>
          ) : (
            <RemoveLiquidityOutput />
          )
        }
        disableTokenSelect
        disableUnlock
      />
      <OversizedPanel key="remove-liquidity-input-under" hideBottom>
        <SummaryPanel>
          <ExchangeRateWrapper>
            <ExchangeRate>{t('exchangeRate')}</ExchangeRate>
            {marketRate ? <span>{`1 BST = ${amountFormatter(marketRate, 18, 4)} ${symbol}`}</span> : ' - '}
          </ExchangeRateWrapper>
          <ExchangeRateWrapper>
            <ExchangeRate>{t('currentPoolSize')}</ExchangeRate>
            {exchangeETHBalance && exchangeTokenBalance && (decimals || decimals === 0) ? (
              <span>{`${amountFormatter(exchangeETHBalance, 18, 4)} BST + ${amountFormatter(
                exchangeTokenBalance,
                decimals,
                Math.min(decimals, 4)
              )} ${symbol}`}</span>
            ) : (
              ' - '
            )}
          </ExchangeRateWrapper>
          <ExchangeRateWrapper>
            <ExchangeRate>
              {t('yourPoolShare')} ({ownershipPercentageFormatted && ownershipPercentageFormatted}%)
            </ExchangeRate>
            {ETHOwnShare && TokenOwnShare ? (
              <span>
                {`${amountFormatter(ETHOwnShare, 18, 4)} BST + ${amountFormatter(
                  TokenOwnShare,
                  decimals,
                  Math.min(decimals, 4)
                )} ${symbol}`}
              </span>
            ) : (
              ' - '
            )}
          </ExchangeRateWrapper>
        </SummaryPanel>
      </OversizedPanel>
      {renderSummary()}
      <Flex>
        <Button disabled={!isValid} onClick={onRemoveLiquidity}>
          {t('removeLiquidity')}
        </Button>
      </Flex>
    </>
  )
}
