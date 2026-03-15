import React, { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi'

import WalletAddress from './WalletAddress'
import WalletScanner from './WalletScanner'
import WalletStatus from './WalletStatus'

export default function ConnectWallet() {
  // Pull address and chain directly from useAccount (Wagmi v2)
  const { address, isConnected, connector, chain } = useAccount()
  
  // Use connectors and connect function from the hook
  const { connect, connectors } = useConnect()
  const { disconnectAsync } = useDisconnect()
  const { signMessageAsync } = useSignMessage()

  const [stayConnected, setStayConnected] = useState(false)
  const [duration, setDuration] = useState(3600)
  const [timeLeft, setTimeLeft] = useState(3600)
  const [nonce, setNonce] = useState('')
  const [signature, setSignature] = useState<string | null>(null)

  /* SESSION TIMER */
  useEffect(() => {
    if (!stayConnected || !isConnected) return
    setTimeLeft(duration)
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleDisconnect()
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [stayConnected, duration, isConnected])

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
    return `${Math.floor(seconds / 86400)}d`
  }

  /* SIGNATURE & NONCE */
  const handleSignature = async () => {
    if (!address) return
    const sessionNonce = stayConnected
      ? localStorage.getItem('walletNonce') || Math.floor(Math.random() * 1000000).toString()
      : Math.floor(Math.random() * 1000000).toString()
    
    if (stayConnected && !localStorage.getItem('walletNonce')) {
      localStorage.setItem('walletNonce', sessionNonce)
    }
    setNonce(sessionNonce)

    const msg = `Wallet Intelligence Login - Nonce: ${sessionNonce}`
    try {
      const sig = await signMessageAsync({ message: msg })
      setSignature(sig)
    } catch (err) {
      console.error('Signature failed:', err)
      setSignature(null)
    }
  }

  /* HANDLERS */
  const handleDisconnect = async () => {
    await disconnectAsync()
    setSignature(null)
    setNonce('')
    localStorage.removeItem('walletNonce')
    localStorage.removeItem('lastWallet')
  }

  /* AUTO RECONNECT LOGIC */
  useEffect(() => {
    if (isConnected && address) {
      localStorage.setItem('lastWallet', address)
      if (!signature) handleSignature()
    }
  }, [isConnected, address])

  return (
    <div className="connect-wallet">
      {/* DYNAMIC CONNECTOR LIST */}
      {!isConnected &&
        connectors.map((c) => (
          <button 
            key={c.uid} 
            onClick={() => connect({ connector: c })} 
            className="btn-connect"
          >
            Connect {c.name}
          </button>
        ))}

      {isConnected && address && (
        <>
          <div className="wallet-info">
            <span className="pulse-dot" />
            <WalletAddress account={address} chainId={chain?.id} />
            <WalletStatus account={address} chainId={chain?.id} />
            <button onClick={handleDisconnect} className="btn-disconnect">Disconnect</button>
          </div>
          <WalletScanner account={address} chainId={chain?.id} />
        </>
      )}

      {/* SESSION SLIDER */}
      {isConnected && (
        <div className="session-slider">
          <label>
            <input type="checkbox" checked={stayConnected} onChange={e => setStayConnected(e.target.checked)} />
            Stay Connected
          </label>
          {stayConnected && (
            <>
              <input 
                type="range" 
                min={60} 
                max={2592000} 
                value={duration} 
                onChange={e => setDuration(parseInt(e.target.value))} 
              />
              <div className="time-display">{formatTime(timeLeft)}</div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
