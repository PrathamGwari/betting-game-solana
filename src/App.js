import React, { useEffect, useState, useCallback } from "react";
import {
  Connection,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
  Transaction,
  Keypair,
  sendAndConfirmRawTransaction,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import bs58 from 'bs58';
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import io from "socket.io-client";

window.Buffer = Buffer;
const App = () => {
  const [connection, setConnection] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [publicKey, setPublicKey] = useState(null);
  const [amount, setAmount] = useState(0);
  const [socket, setSocket] = useState(null);
  const [socketId, setSocketId] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [winnerTransferStatus, setWinnerTransferStatus] = useState(null)

  function uintArrayToStringBuffer(uintArray) {
    // Use String.fromCharCode to convert each uint value to a character
    const string = String.fromCharCode(...uintArray);
    // Create a String Buffer from the string
    return new TextEncoder().encode(string);
  }

  // Function to redirect to another app with public key as query parameter
  const openGameInNewWindow = (publicKey) => {
    const url = `http://localhost:3001?publicKey=${publicKey}`;
    window.open(url, "_blank");
  };

  // Function to connect to wallet
  const connectWallet = async () => {
    console.log("Trying to connect to wallet");
    const connection = new Connection(
      "https://api.devnet.solana.com",
      "recent"
    );
    setConnection((oldConnection) => connection);

    const wallet = new PhantomWalletAdapter();
    await wallet.connect();

    console.log("wallet details", wallet);
    setWallet((oldWallet) => wallet);

    console.log("Wallet connected");
    const publicKey = wallet.publicKey;
    setPublicKey(publicKey);
  };

  useEffect(() => {
    if (publicKey) {
      console.log("public key changed");
      // After wallet is connected, initiate WebSocket connection
      initWebSocket(publicKey);

      // Redirect to game
      openGameInNewWindow(publicKey);
    }
  }, [publicKey]);

  // Function to initialize WebSocket connection
  const initWebSocket = (publicKey) => {
    const socket = io("ws://localhost:8000");
    setSocket(socket);

    // Send data containing client type and public key after successful connection
    socket.emit("init", { clientType: "website", publicKey: publicKey });

    // Set socket ID after successful connection
    socket.on("connect", () => {
      setSocketId(socket.id);
    });

    // Handle incoming messages from WebSocket server
    socket.on("placeBid", async (data) => {
      console.log("Received message from WebSocket server:", data);
      // Extract bid amount from data
      const bidAmount = data.bidAmount;
      console.log("Placing bid:", bidAmount);
      // Place bid logic here
      console.log(bidAmount, wallet, connection, publicKey);
      if (bidAmount && wallet && connection && publicKey) {
        console.log("transfer initiated");
        // Transfer SOL on bid (uncomment if needed)
        await transferSOL(socket, bidAmount);

        // emit payment success message to server
        socket.emit("paymentSuccess", {
          clientType: "website",
          publicKey: publicKey,
        });
      }
    });

    socket.on("transferToWinner", async (data) => {
      try {
        const { bidAmount } = data;
        transferToWinner(bidAmount);
      } catch (err) {
        console.error(err);
        socket.emit("winnerTransferFailed", { publicKey });
      }
    });

    // Close the socket when component unmounts
    return () => {
      socket.close();
    };
  };

  // Function to transfer SOL
  const transferSOL = async (socket, bidAmount) => {
    try {
      // Define recipient address
      const recipientAddress = new PublicKey(
        "7F7osfgRp67s4ooVz1rchSeQJrGQqptUBQWG3sxvpp7n"
      );

      console.log("creating transaction");
      // Create transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: recipientAddress,
          lamports: LAMPORTS_PER_SOL * bidAmount,
        })
      );

      // Sign and send transaction
      const blockhash = await connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash.blockhash;
      transaction.feePayer = publicKey;
      const signedTransaction = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(
        signedTransaction.serialize()
      );

      console.log("Transaction sent with signature:", signature);

      // **Confirmation Check**
      try {
        const confirmedTransaction = await connection.confirmTransaction(
          signature
        );
        console.log("Transaction confirmed:", confirmedTransaction);

        setPaymentStatus("success");
      } catch (confirmationError) {
        console.error("Transaction confirmation failed:", confirmationError);
        // Handle unsuccessful transaction here (e.g., display error message to user)
      }
    } catch (error) {
      console.log("Error signing or sending transaction:", error);
      setPaymentStatus("failed");
    }
  };

  // Function to transfer SOL to winner
  const transferToWinner = async (winning_amount) => {
    try {
      const gameAddress = new PublicKey(
        "7F7osfgRp67s4ooVz1rchSeQJrGQqptUBQWG3sxvpp7n"
      );
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: gameAddress, // The game's wallet address
          toPubkey: publicKey, // The winner's wallet address
          lamports: LAMPORTS_PER_SOL * winning_amount,
        })
      );

      // server's private key
      // You need the secret key of the game's wallet to sign the transaction
      const secretKey =
        "5prCnVwfA7QRYvuFYMm8VUTmr9CNVi39EMgXHvaDpGfjtVfiBzpmyzTcEMKhXRrG6N2Ct9JDaWFcTiz1fkfWWBeC";
      const secretKeyUint8Array = Buffer.from(bs58.decode(secretKey));
      console.log('secret kye u in 8 array', secretKeyUint8Array)
      const gameKeypair = Keypair.fromSecretKey(secretKeyUint8Array);

      console.log('signing transaction for winner')
      transaction.recentBlockhash = (
        await connection.getRecentBlockhash()
      ).blockhash;
      transaction.sign(gameKeypair); // Sign the transaction with the game's keypair

      console.log('key', gameKeypair._keypair.secretKey)
      console.log(connection, transaction, gameKeypair)
      const signature = await sendAndConfirmRawTransaction(
        connection,
        transaction.serialize()
      );

      console.log("Winning transaction confirmed:", signature);

      setWinnerTransferStatus("success")
    } catch (error) {
      console.error("Error transferring winning amount:", error);
      setWinnerTransferStatus("failed")
    }
  };

  useEffect(() => {
    if (socket && paymentStatus) {
      if (paymentStatus === "success") {
        socket.emit("paymentSuccess", { publicKey });
      } else if (paymentStatus === "failed") {
        socket.emit("paymentFailed", { publicKey });
      }
    }
  }, [paymentStatus]);

  useEffect(() => {
    console.log('winner status', winnerTransferStatus)
    if (socket && winnerTransferStatus) {
      if (winnerTransferStatus === "success") {
        socket.emit("winnerTransferSuccess", { publicKey });
      } else if (winnerTransferStatus === "failed") {
        socket.emit("winnerTransferFailed", { publicKey });
      }
    }
  }, [winnerTransferStatus]);

  return (
    <div>
      {socketId && <h1>Socket ID: {socketId}</h1>}
      {/* {wallet && <h1>Wallet Id: {wallet.name}</h1>} */}
      {publicKey ? (
        <div>
          <p>Wallet Connected: {publicKey.toString()}</p>
          <button onClick={() => setPublicKey(null)}>Disconnect Wallet</button>
        </div>
      ) : (
        <button onClick={connectWallet}>Connect Wallet</button>
      )}
      {/* <iframe
        src="https://i.simmer.io/@AkashSinha/horse-race-bet"
        title="Horse Race Bet"
        style={{ width: "960px", height: "600px" }}
      ></iframe> */}
    </div>
  );
};

export default App;
