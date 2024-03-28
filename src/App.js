
import { PublicKey, SystemProgram, Transaction,LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useState } from 'react';
function App(){

  const [wallet,setwallet ]= useState(null);
  const [status , setStatus]= useState('disconnected');
  const [publickey , setpublickey] =useState('');

const connectWallet = async () => {
  
    try {
        const resp = await window.solana.connect();
       setwallet(resp);

        window.solana.on("connect", () => setStatus("Connected"));
        const publicKey = window.solana.publicKey.toString();
        setpublickey(publicKey);

        const fromAddress = resp.publicKey; // Assuming resp contains the publicKey
        const recipientAddress = 'HZ7kTxdn7eMJJJRv4nRN1yLDmzC9h6iMZqRX5CVa63xe'; // Example recipient address
        const amount = 1; // Amount in SOL

        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: fromAddress,
                toPubkey: new PublicKey(recipientAddress),
                lamports: LAMPORTS_PER_SOL * amount, // Convert SOL to lamports
            })
        );

        // Sign and send the transaction
        const signature = await window.solana.signAndSendTransaction(transaction);
        console.log('Transaction sent with signature:', signature);
    } catch (err) {
        // Handle error
        console.error('Failed to connect to Phantom:', err);
    }
};
return (
  <div className="App">
      <button onClick={connectWallet}>Connect Wallet</button>
      <p>Status: {publickey}</p>
  </div>
);
}
export default App;