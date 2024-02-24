import './App.css';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { useEffect, useState } from "react";
import './App.css'

// import to fix polyfill issue with buffer with webpack
import * as buffer from "buffer";
window.Buffer = buffer.Buffer;

// create types
type DisplayEncoding = "utf8" | "hex";

type PhantomEvent = "disconnect" | "connect" | "accountChanged";
type PhantomRequestMethod =
  | "connect"
  | "disconnect"
  | "signTransaction"
  | "signAllTransactions"
  | "signMessage";

interface ConnectOpts {
  onlyIfTrusted: boolean;
}

// create a provider interface (hint: think of this as an object) to store the Phantom Provider
interface PhantomProvider {
  publicKey: PublicKey | null;
  isConnected: boolean | null;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
  signMessage: (
    message: Uint8Array | string,
    display?: DisplayEncoding
  ) => Promise<any>;
  connect: (opts?: Partial<ConnectOpts>) => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  on: (event: PhantomEvent, handler: (args: any) => void) => void;
  request: (method: PhantomRequestMethod, params: any) => Promise<unknown>;
}

/**
* @description gets Phantom provider, if it exists
*/
const getProvider = (): PhantomProvider | undefined => {
  if ("solana" in window) {
    // @ts-ignore
    const provider = window.solana as any;
    if (provider.isPhantom) return provider as PhantomProvider;
  }
};

export default function App() {
  // create state variables for the provider, receiver public key, sender keypair, and wallet balance
  const [provider, setProvider] = useState<PhantomProvider | undefined>(
    undefined
  );
  const [receiverPublicKey, setReceiverPublicKey] = useState<PublicKey | undefined>(
    undefined
  );
  const [senderKeypair, setSenderKeypair] = useState<Keypair | undefined>(
    undefined
  );
  const [walletBalance, setWalletBalance] = useState<number | undefined>(
    undefined
  );
   const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  // connection to use with local solana test validator
  //const connection = new Connection("http://127.0.0.1:8899", "confirmed");

  // this is the function that runs whenever the component updates (e.g. render, refresh)
  useEffect(() => {
    const provider = getProvider();

    // if the phantom provider exists, set this as the provider
    if (provider) setProvider(provider);
    else setProvider(undefined);
  }, []);

  /**
   * @description creates a new KeyPair and airdrops 2 SOL into it.
   * This function is called when the Create a New Solana Account button is clicked
   */
  const createSender = async () => {
    try {
      // create a new Keypair
      const acctCreated = new Keypair()
      console.log('New Solana Sender account: ', acctCreated.publicKey.toString());
      console.log('Airdropping 2 SOL to Sender Wallet');

      // request airdrop into this new account
      const senderacct = await connection.requestAirdrop(
        new PublicKey(acctCreated.publicKey),
        2 * LAMPORTS_PER_SOL
      )

      const latestBlockHash = await connection.getLatestBlockhash();

    // now confirm the transaction

    console.log('Wallet Balance: ' + (await connection.getBalance(acctCreated.publicKey)) / LAMPORTS_PER_SOL);
    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: senderacct
    })

      // save this new KeyPair into this state variable
      setSenderKeypair(acctCreated);

      // fetch and set the balance of the new account
      const balance = await connection.getBalance(acctCreated.publicKey);
      setWalletBalance(balance / LAMPORTS_PER_SOL);

      console.log('Airdrop has been sent, new wallet balance is: ' + balance / LAMPORTS_PER_SOL)
    } catch (error) {
      console.error("Error creating sender:", error);
    }
  }

  /**
   * @description prompts user to connect wallet if it exists.
   * This function is called when the Connect to Phantom Wallet button is clicked
   */
  const connectWallet = async () => {
    // @ts-ignore
    const { solana } = window;

    // checks if phantom wallet exists
    if (solana) {
      try {
        // connect to phantom wallet and return response which includes the wallet public key
        const response = await solana.connect();
        console.log("Phantom wallet connected: ", response.publicKey.toString())
        // save the public key of the phantom wallet to the state variable
        setReceiverPublicKey(response.publicKey);

        // fetch and set the balance of the connected wallet
        const balance = await connection.getBalance(response.publicKey);
        setWalletBalance(balance / LAMPORTS_PER_SOL);
      } catch (err) {
        console.error("Error connecting wallet:", err);
      }
    }
  };

  /**
   * @description disconnects wallet if it exists.
   * This function is called when the disconnect wallet button is clicked
   */
  const disconnectWallet = async () => {
    // @ts-ignore
    const { solana } = window;

    // checks if phantom wallet exists
    if (solana) {
      try {
        solana.disconnect();
        setReceiverPublicKey(undefined);
        console.log("Wallet disconnected")
      } catch (err) {
        console.error("Error disconnecting wallet:", err);
      }
    }
  };

  /**
   * @description transfer SOL from sender wallet to connected wallet.
   * This function is called when the Transfer SOL to Phantom Wallet button is clicked
   */
  const transferSol = async () => {    
    try {
      // checking available balance on wallets before transaction
      console.log("Sender Balance: " + (await connection.getBalance(senderKeypair!.publicKey)) / LAMPORTS_PER_SOL)
      console.log("Receiver Balance: " + (await connection.getBalance(receiverPublicKey!)) / LAMPORTS_PER_SOL)
      
      const SolanaAcctPublicKey = senderKeypair!.publicKey;
      const PhantomWalletPublicKey = receiverPublicKey!;

      // create a new transaction for the transfer
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: SolanaAcctPublicKey,
          toPubkey: PhantomWalletPublicKey,
          lamports: 1 * LAMPORTS_PER_SOL
        })
      );

      // send and confirm the transaction
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [senderKeypair!]
      );
      console.log('Signature is', signature);

      console.log("Transaction sent and confirmed");
      console.log("Sender Balance: " + (await connection.getBalance(senderKeypair!.publicKey)) / LAMPORTS_PER_SOL);
      console.log("Receiver Balance: " + (await connection.getBalance(receiverPublicKey!)) / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error("Error transferring SOL:", err);
    }
  };

  // HTML code for the app
  return (
    <div className="App">
      <header className="App-header">
        <h2>Module 2 Assessment</h2>
        <span className ="buttons">
          <button
            style={{
              fontSize: "16px",
              padding: "15px",
              fontWeight: "bold",
              borderRadius: "5px",
            }}
            onClick={createSender}
          >
            Create a New Solana Account
          </button>
          {provider && !receiverPublicKey && (
            <button
              style={{
                fontSize: "16px",
                padding: "15px",
                fontWeight: "bold",
                borderRadius: "5px",
              }}
              onClick={connectWallet}
            >
              Connect to Phantom Wallet
            </button>
          )}
          {provider && receiverPublicKey && (
            <div>
              <button
                style={{
                  fontSize: "16px",
                  padding: "15px",
                  fontWeight: "bold",
                  borderRadius: "5px",
                  position: "absolute",
                  top: "28px",
                  right: "28px"
                }}
                onClick={disconnectWallet}
              >
                Disconnect from Wallet
              </button>
              <p>Wallet Balance: {walletBalance} SOL</p>
            </div>
          )}
          {provider && receiverPublicKey && senderKeypair && (
          <button
            style={{
              fontSize: "16px",
              padding: "15px",
              fontWeight: "bold",
              borderRadius: "5px",
            }}
            onClick={transferSol}
          >
            Transfer SOL to Phantom Wallet
          </button>
          )}
        </span>
        {!provider && (
          <p>
            No provider found. Install{" "}
            <a href="https://phantom.app/">Phantom Browser extension</a>
          </p>
        )}
      </header>
    </div>
  );
}