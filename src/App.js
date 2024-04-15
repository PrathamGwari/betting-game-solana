import React, { useEffect, useState,useCallback } from 'react';
import { Connection, SystemProgram, Keypair, Transaction, PublicKey, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from '@solana/web3.js';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { Buffer } from 'buffer';
import WebSocket from 'isomorphic-ws'
import bs58 from 'bs58';
import axios from 'axios';

window.Buffer = Buffer;

const App = () => {
    const [connection, setConnection] = useState(null);
    const [wallet, setWallet] = useState(null);
    const [publicKey, setPublicKey] = useState(null);
    const [amount , setAmount] = useState(0);
    const [Response , Setresponse]=useState(null);
    const connectWallet = async () => {

        const connection = new Connection('https://api.devnet.solana.com', 'recent');
        setConnection(connection);

        const wallet = new PhantomWalletAdapter();
        await wallet.connect();
        setWallet(wallet);

        const publicKey = wallet.publicKey;
        setPublicKey(publicKey);
    };
    
    const checkTransactionResult = async () => {
      try {
          const response = await axios.get('http://localhost:3000/api/transactionResult');
          Setresponse(response);
          console.log('Transaction result:', response.data.transactionResult);
          if (response.data.transactionResult) {
              // Start the race
          }
      } catch (error) {
       
          console.error('Error fetching transaction result:', error);
          console.log('Transaction result:', Response.data.transactionResult);
      }
  };
  
    const transferSOL = useCallback(async (bid_amount) => {

      const address = new PublicKey("HZ7kTxdn7eMJJJRv4nRN1yLDmzC9h6iMZqRX5CVa63xe");
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: address,
          lamports: LAMPORTS_PER_SOL * bid_amount,
        })
    );
    
      try {
        const blockhash = await connection.getRecentBlockhash();
        transaction.recentBlockhash = blockhash.blockhash;
        transaction.feePayer = publicKey;
        const signedTransaction = await wallet.signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signedTransaction.serialize());
   
        console.log('Transaction sent with signature:', signature);
        window.alert('Transaction confirmed: ' + signature); 
         await axios.post('http://localhost:3000/api/transaction', { signature });
     
        await checkTransactionResult();
      } catch (error) {
        const response = await axios.post('http://localhost:3000/api/transaction', { signature: 'failed' });
      
     
        await checkTransactionResult();
        console.error('Error signing or sending transaction:', error);
      }
    }, [publicKey, connection, wallet]);
  
  
    const transferToWinner = useCallback(async (winning_amount) => {
           try {
            const gameAddress = new PublicKey("HZ7kTxdn7eMJJJRv4nRN1yLDmzC9h6iMZqRX5CVa63xe");
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: gameAddress,  // The game's wallet address
                    toPubkey: publicKey,      // The winner's wallet address
                    lamports: LAMPORTS_PER_SOL * winning_amount,
                })
            );
        
            // You need the secret key of the game's wallet to sign the transaction
            const secretKey = "5RBLxEjfUXR1QWv7GykyevCfPMkQStkTUAu6wFnSzjGhRZs9AVAnPrAqg5uZuMKe47NpMmoq8kdVbDLqgirhQMy4";
            const secretKeyUint8Array = Buffer.from(bs58.decode(secretKey));
            const gameKeypair = Keypair.fromSecretKey(secretKeyUint8Array);
        
            transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
            transaction.sign(gameKeypair);  // Sign the transaction with the game's keypair
        
            const signature = await sendAndConfirmTransaction(
                connection,
                transaction,
                [gameKeypair],  // Signer
                { commitment: 'confirmed' },
            );
        
            console.log('Winning transaction confirmed:', signature);
        } catch (error) {
            console.error('Error transferring winning amount:', error);
        }
      }, [publicKey, connection]);
  


    useEffect(() => {
      const socket = new WebSocket('ws://localhost:3000');

      socket.onmessage = (event) => {
          const data = JSON.parse(event.data);

          if (data.amount && connection && wallet && publicKey) {
              setAmount(data.amount);
              console.log('Bid received:', data.amount);
              transferSOL(data.amount); // Uncomment if you want to transfer SOL on bid
          }

          if (data.winner && data.winner === 'Some Winner') {
              console.log('Winner received:', data.winner);
              const winningAmount = 4 * amount;
              transferToWinner(winningAmount);
          }
      };

      return () => {
          socket.close();
      };
    }, [connection, publicKey, wallet, amount, transferSOL, transferToWinner]);
    return (
      <div>
          {publicKey ? (
              <div>
                  <p>Wallet Connected: {publicKey.toString()}</p>
                  <button onClick={() => setPublicKey(null)}>Disconnect Wallet</button>
              </div>
          ) : (
              <button onClick={connectWallet}>Connect Wallet</button>
          )}
          <iframe src="https://i.simmer.io/@AkashSinha/horse-race-bet" title="Horse Race Bet" style={{ width: '960px', height: '600px' }}></iframe>
      </div>
  );
};

export default App;