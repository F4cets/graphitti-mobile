import React, { createContext, useState, useEffect, ReactNode, FC } from 'react';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { doc, getDoc, setDoc, updateDoc } from '@react-native-firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { signInAnonymously, onAuthStateChanged } from '@react-native-firebase/auth';
import { Alert } from 'react-native';

interface WalletContextType {
  user: any;
  setUser: (user: any) => void;
  walletAddress: string | null;
  connectWallet: () => Promise<void>;
}

export const WalletContext = createContext<WalletContextType | null>(null);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: FC<WalletProviderProps> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [authUser, setAuthUser] = useState<any>(null);

  // Auth listener
  useEffect(() => {
    console.log('Setting up auth listener');
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log('Auth state changed, user exists:', !!firebaseUser);
      setAuthUser(firebaseUser);
      setAuthReady(!!firebaseUser);
    });
    return () => {
      console.log('Unsubscribing auth listener');
      unsubscribe();
    };
  }, []);

  // Sync user
  useEffect(() => {
    if (authReady && walletAddress && authUser) {
      (async () => {
        try {
          console.log('Starting user sync');
          const userRef = doc(db, 'users', walletAddress);
          const userDoc = await getDoc(userRef);
          console.log('getDoc completed, exists:', userDoc.exists);
          let userData = userDoc.data();
          if (!userDoc.exists) {
            console.log('Creating new user doc');
            userData = {
              wallet: walletAddress,
              playsToday: 0,
              lastPlay: Date.now(),
              credits1x: 0,
              credits2x: 0,
              credits3x: 0,
              winTallyUSD: 0,
              withdrawalTxs: [],
              authUid: authUser.uid,
              referredBy: '',
              referralCode: '',
              referralsCount: 0,
              wins: 0,
              losses: 0,
              games: []
            };
            await setDoc(userRef, userData);
            console.log('setDoc completed');
          } else {
            // Reset free plays if >24hrs since lastPlay
            const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
            if (Date.now() - userData.lastPlay > TWENTY_FOUR_HOURS) {
              console.log('Resetting playsToday due to 24h elapsed');
              userData.playsToday = 0;
              userData.lastPlay = Date.now();
              await updateDoc(userRef, { playsToday: 0, lastPlay: Date.now() });
            }
          }
          // Calculate remaining tags
          const remainingFree = 3 - userData.playsToday;
          const remainingTags = remainingFree + (userData.credits1x || 0) + (userData.credits2x || 0) + (userData.credits3x || 0);
          userData.remainingTags = remainingTags;
          setUser(userData);
          console.log('User set:', userData); // Debug full user
          console.log('User sync completed');
        } catch (syncError) {
          console.error('Sync error:', syncError);
        }
      })();
    }
  }, [authReady, walletAddress, authUser]);

  const connectWallet = async () => {
    const hardcodedAddress = '7zSHhq7H6cRrFCjjeDpsjWG8jAS5k7ro9JQRr329w3SK';
    try {
      console.log('Starting connectWallet');
      if (!authReady) {
        console.log('Auth not ready, signing in');
        await signInAnonymously(auth);
        console.log('signInAnonymously completed');

        // Await authReady via temp listener (resolves when user is set)
        await new Promise((resolve, reject) => {
          const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
              console.log('Temp listener: Auth ready');
              unsubscribe(); // Cleanup
              resolve(null);
            }
          });
          // Timeout as fallback
          setTimeout(() => {
            unsubscribe();
            reject(new Error('Auth ready timeout'));
          }, 5000);
        });
      }
      setWalletAddress(hardcodedAddress);
      console.log('Wallet address set, sync will trigger');
    } catch (error: unknown) {
      console.error('Wallet connect error:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message, 'stack:', error.stack);
        Alert.alert('Connection Failed', error.message || 'Unknown error');
      } else {
        Alert.alert('Connection Failed', String(error) || 'Unknown error');
      }
    }
  };

  return (
    <WalletContext.Provider value={{ user, setUser, walletAddress, connectWallet }}>
      {children}
    </WalletContext.Provider>
  );
};