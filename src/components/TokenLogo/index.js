import React from 'react'
import styled from 'styled-components'
import { isAddress } from '../../utils'
import { ReactComponent as EthereumLogo } from '../../assets/images/ethereum-logo.svg'

const BAD_URIS = {}

const TOKEN_ICON_API = address =>
  `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${address}/logo.png`

const Image = styled.img`
  width: ${({ size }) => size};
  height: ${({ size }) => size};
  background-color: transparent;
  border-radius: 1rem;
`

const Emoji = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${({ size }) => size};
  height: ${({ size }) => size};
`

const StyledEthereumLogo = styled(EthereumLogo)`
  width: ${({ size }) => size};
  height: ${({ size }) => size};
`

export default function TokenLogo({ address, size = '1rem', ...rest }) {
  // If the address is BST token address, return the BST logo
  if (address === '0x965f527d9159dce6288a2219db51fc6eef120dd1') {
    return <Image src="/dexlogomain.png" size={size} alt="BST Logo" {...rest} />
  }

  let path = ''
  const validated = isAddress(address)

  if (validated) {
    path = TOKEN_ICON_API(validated)
  }

  // Return the default logo for all cases
  return <Image src="/dexlogomain.png" size={size} alt="Token Logo" {...rest} />
}
