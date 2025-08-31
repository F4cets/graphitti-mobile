import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ImageBackground, Modal, Alert, Linking, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, useColorScheme } from 'react-native';
import { useSharedValue, withTiming, createAnimatedComponent, runOnJS, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import Sound from 'react-native-sound';
import { WalletContext } from './contexts/WalletContext';
import { RPC_ENDPOINT } from '@env';
import { db } from './firebaseConfig';
import NetInfo from '@react-native-community/netinfo';
import Video from 'react-native-video';
import { doc, updateDoc, increment, getDoc, collection, onSnapshot, arrayUnion } from '@react-native-firebase/firestore';
import { Connection } from '@solana/web3.js'; 
import { useWindowDimensions } from 'react-native';

const connection = new Connection(RPC_ENDPOINT);

const AnimatedView = createAnimatedComponent(View);

export default function App() {
 const [solPrice, setSolPrice] = useState<string>('163.52');
 const [isFlashing, setIsFlashing] = useState<boolean>(false);
 const [selectedTime, setSelectedTime] = useState<number>(10);
 const [aiSuccess, setAiSuccess] = useState<number>(69);
 const [priceHistory, setPriceHistory] = useState<number[]>([]);
 const [prediction, setPrediction] = useState<string | null>(null);
 const [startPrice, setStartPrice] = useState<number | null>(null);
 const [timer, setTimer] = useState<number>(0);
 const [gameState, setGameState] = useState<string>('idle');
 const [showPopup, setShowPopup] = useState<boolean>(false);
 const [countdown, setCountdown] = useState<string | null>(null);
 const [isAiFlashing, setIsAiFlashing] = useState<boolean>(false);
 const [levelUsed, setLevelUsed] = useState<string | null>(null);
 const [showModal, setShowModal] = useState<boolean>(false);
 const [isWithdrawing, setIsWithdrawing] = useState<boolean>(false);
 const [withdrawSuccess, setWithdrawSuccess] = useState<boolean>(false);
 const [userCount, setUserCount] = useState<number>(0);
 const [videoPlaying, setVideoPlaying] = useState<boolean>(false);

 const { user, setUser, walletAddress, connectWallet } = useContext(WalletContext)!;
 const videoRef = useRef<Video>(null);
 const flashAnim = useSharedValue(0);
 const aiFlashAnim = useSharedValue(0); // For AI flash
 const winScale = useSharedValue(0);
 const loseScale = useSharedValue(0.8);
 const { width: screenWidth, height: screenHeight } = useWindowDimensions();

 // Init Firebase and userCount
 useEffect(() => {
 const usersCollection = collection(db, 'users');
 const unsubscribe = onSnapshot(usersCollection, (snapshot) => {
 setUserCount(snapshot.size);
 });
 return unsubscribe;
 }, []);

 // Fetch initial SOL price from Pyth API
 useEffect(() => {
 (async () => {
 try {
 const response = await fetch('https://hermes.pyth.network/api/latest_price_feeds?ids[]=0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d');
 const data = await response.json();
 if (data && data.length > 0) {
 const priceData = data[0].price;
 const rawPrice = parseInt(priceData.price, 10);
 const expo = parseInt(priceData.expo, 10);
 const newPrice = (rawPrice * Math.pow(10, expo)).toFixed(2);
 setSolPrice(newPrice);
 setPriceHistory([parseFloat(newPrice)]);
 }
 } catch (error) {
 console.error('Initial Pyth fetch error:', error);
 }
 })();
 }, []);

 // Pyth REST polling every 500ms
 useEffect(() => {
 NetInfo.fetch().then(state => {
 if (!state.isConnected) Alert.alert('No Internet', 'Price updates require connection.');
 });

 const pollInterval = setInterval(async () => {
 try {
 const response = await fetch('https://hermes.pyth.network/api/latest_price_feeds?ids[]=0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d');
 if (!response.ok) {
 console.error(`REST poll failed with status: ${response.status}`);
 return; // Gracefully skip
 }
 const data = await response.json();
 try {
 if (data && data.length > 0) {
 const priceData = data[0].price;
 const rawPrice = parseInt(priceData.price, 10);
 const expo = parseInt(priceData.expo, 10);
 const newPrice = (rawPrice * Math.pow(10, expo)).toFixed(2);
 if (newPrice !== solPrice) {
 console.log('New price from REST poll:', newPrice);
 setSolPrice(newPrice);
 setIsFlashing(true);
 flashAnim.value = withTiming(1, { duration: 1000 }, () => {
 flashAnim.value = withTiming(0);
 runOnJS(setIsFlashing)(false);
 });
 setPriceHistory((prev) => [...prev, parseFloat(newPrice)].slice(-5));
 }
 }
 } catch (parseError) {
 console.error('REST poll parsing error:', parseError);
 // Silently skip invalid data
 }
 } catch (error) {
 console.error('REST poll error:', error);
 // Silently continue polling
 }
 }, 500); // 500ms = 2 req/sec

 return () => clearInterval(pollInterval);
 }, []);

 const updateAiSuccess = useCallback((history: number[]) => {
 if (history.length < 2) return;
 let ups = 0;
 for (let i = 1; i < history.length; i++) {
 if (history[i] > history[i-1]) ups++;
 }
 let prob = (ups / (history.length - 1)) * 100;
 const bias = 50 + Math.random() * 20;
 prob = (prob + bias) / 2;
 if (selectedTime === 5) prob = Math.min(prob * 0.8, 93);
 else if (selectedTime === 15) prob = Math.max(prob * 1.2, 11);
 if (prediction === 'down') prob = 100 - prob;
 prob = Math.max(11, Math.min(93, Math.round(prob)));
 setAiSuccess(prob);
 setIsAiFlashing(true);
 setTimeout(() => setIsAiFlashing(false), 1000);
 }, [selectedTime, prediction]);

 // Update AI
 useEffect(() => {
 if (priceHistory.length > 1) updateAiSuccess(priceHistory);
 }, [prediction, selectedTime, priceHistory, updateAiSuccess]); // Added deps

 // Timer countdown
 useEffect(() => {
 let interval: number | undefined;
 if (timer > 0) {
 interval = setInterval(() => setTimer(prev => prev - 1), 1000);
 }
 return () => {
 if (interval) clearInterval(interval);
 };
 }, [timer]);

 // Win/Lose logic
 useEffect(() => {
 if (timer === 0 && gameState === 'running') {
 const endPrice = parseFloat(solPrice);
 let isWin = (prediction === 'up' && endPrice > (startPrice ?? 0)) || (prediction === 'down' && endPrice < (startPrice ?? 0));
 let outcome = isWin ? 'win' : 'loss';
 if (endPrice === (startPrice ?? 0)) {
 isWin = false;
 outcome = 'loss';
 }
 setGameState(isWin ? 'win' : 'lose');
 setShowPopup(false);
 if (user) {
 const userRef = doc(db, 'users', user.wallet);
 const gameData = {
 timestamp: Date.now(),
 prediction,
 timeInterval: selectedTime,
 startPrice,
 endPrice,
 aiSuccess,
 outcome
 };
 const updateData = {
 lastPlay: Date.now(),
 games: arrayUnion(gameData)
 } as any; // As any
 let localUpdates = {
 lastPlay: Date.now(),
 games: [...(user.games || []), gameData] // Local array union
 };
 if (isWin) {
 updateData.wins = increment(1);
 const usdReward = getUsdReward(selectedTime, levelUsed);
 updateData.winTallyUSD = increment(usdReward);
 localUpdates.wins = (user.wins || 0) + 1;
 localUpdates.winTallyUSD = (user.winTallyUSD || 0) + usdReward;
 const statsRef = doc(db, 'stats', 'global');
 updateDoc(statsRef, { totalWinsUSD: increment(usdReward) });
 } else {
 updateData.losses = increment(1);
 localUpdates.losses = (user.losses || 0) + 1;
 }
 updateDoc(userRef, updateData);
 setUser((prev: any) => ({ ...prev, ...localUpdates }));
 }
 if (!isWin) {
 setTimeout(() => {
 setGameState('idle');
 setPrediction(null);
 setStartPrice(null);
 }, 3000);
 }
 }
 }, [timer, gameState, prediction, startPrice, solPrice, user, selectedTime, levelUsed, aiSuccess]); // Removed setUser from deps

 // Countdown
 useEffect(() => {
 if (user && user.playsToday >= 3) {
 console.log('Countdown effect: playsToday >=3, lastPlay:', user.lastPlay);
 let timeLeft = 86400000 - (Date.now() - user.lastPlay);
 if (timeLeft <= 0) {
 console.log('Time left <=0, resetting');
 updateDoc(doc(db, 'users', user.wallet), { playsToday: 0, lastPlay: Date.now() });
 setUser({ ...user, playsToday: 0, remainingTags: 3 + (user.credits1x || 0) + (user.credits2x || 0) + (user.credits3x || 0) });
 setCountdown(null);
 } else {
 const updateCountdown = () => {
 timeLeft = 86400000 - (Date.now() - user.lastPlay);
 if (timeLeft <= 0) {
 console.log('Interval: Time left <=0, resetting');
 updateDoc(doc(db, 'users', user.wallet), { playsToday: 0, lastPlay: Date.now() });
 setUser({ ...user, playsToday: 0, remainingTags: 3 + (user.credits1x || 0) + (user.credits2x || 0) + (user.credits3x || 0) });
 setCountdown(null);
 } else {
 const hours = Math.floor(timeLeft / 3600000);
 const minutes = Math.floor((timeLeft % 3600000) / 60000);
 const seconds = Math.floor((timeLeft % 60000) / 1000);
 setCountdown(`${hours}h ${minutes}m ${seconds}s`);
 }
 };
 updateCountdown();
 const interval = setInterval(updateCountdown, 1000);
 return () => clearInterval(interval);
 }
 } else {
 console.log('Countdown effect: playsToday <3, no countdown');
 setCountdown(null);
 }
 }, [user]); // Added dep

 // Video playback
 useEffect(() => {
 if (showPopup) {
 setVideoPlaying(true);
 setTimeout(() => setVideoPlaying(false), (selectedTime - 1) * 1000);
 }
 }, [showPopup, selectedTime]);

 // Audio on win/lose
 useEffect(() => {
 if (gameState === 'win') {
 const sound = new Sound('cheers.mp3', Sound.MAIN_BUNDLE, (error) => {
 if (error) console.error('Audio load error:', error);
 else sound.play();
 });
 } else if (gameState === 'lose') {
 const sound = new Sound('sigh.mp3', Sound.MAIN_BUNDLE, (error) => {
 if (error) console.error('Audio load error:', error);
 else sound.play();
 });
 }
 }, [gameState]);

 const handleTagIt = () => {
 if (!user || user.remainingTags <= 0 || !prediction || gameState !== 'idle') return;
 const sound = new Sound('bell.mp3', Sound.MAIN_BUNDLE, (error) => {
 if (error) console.error('Bell audio load error:', error);
 else {
 sound.play();
 setTimeout(() => sound.stop(), (selectedTime - 1) * 1000);
 }
 });
 setStartPrice(parseFloat(solPrice));
 setTimer(selectedTime);
 setShowPopup(true);
 setGameState('running');
 // Deduct tag
 let newPlays = user.playsToday;
 let newCredits1x = user.credits1x || 0;
 let newCredits2x = user.credits2x || 0;
 let newCredits3x = user.credits3x || 0;
 let fieldToUpdate = null;
 let newValue = 0;
 let usedLevel = null;
 if (newPlays < 3) {
 newPlays += 1;
 usedLevel = 'free';
 } else if (newCredits1x > 0) {
 newCredits1x -= 1;
 fieldToUpdate = 'credits1x';
 newValue = newCredits1x;
 usedLevel = '1x';
 } else if (newCredits2x > 0) {
 newCredits2x -= 1;
 fieldToUpdate = 'credits2x';
 newValue = newCredits2x;
 usedLevel = '2x';
 } else if (newCredits3x > 0) {
 newCredits3x -= 1;
 fieldToUpdate = 'credits3x';
 newValue = newCredits3x;
 usedLevel = '3x';
 } else {
 return;
 }
 setLevelUsed(usedLevel);
 const remainingFree = 3 - newPlays;
 const remainingTags = remainingFree + newCredits1x + newCredits2x + newCredits3x;
 const updateData = { playsToday: newPlays, lastPlay: Date.now() };
 if (fieldToUpdate) updateData[fieldToUpdate] = newValue;
 updateDoc(doc(db, 'users', user.wallet), updateData);
 setUser({ ...user, playsToday: newPlays, credits1x: newCredits1x, credits2x: newCredits2x, credits3x: newCredits3x, remainingTags });
 };

 const getUsdReward = (time: number, level: string | null) => {
 if (level === 'free') {
 if (time === 5) return 0.25;
 if (time === 10) return 0.16;
 return 0.08;
 } else if (level === '1x') {
 if (time === 5) return 1.55;
 if (time === 10) return 1.25;
 return 1.08;
 } else if (level === '2x') {
 if (time === 5) return 3.30;
 if (time === 10) return 2.70;
 return 2.40;
 } else if (level === '3x') {
 if (time === 5) return 5.25;
 if (time === 10) return 4.35;
 return 3.90;
 }
 return 0;
 };

 const handleBuyTags = (usdAmount: number) => {
 // Full logic from webapp (adapt tx)
 Alert.alert('Buy', `Buying for ${usdAmount} USD - Mocked`);
 };

 const convertBalance = async () => {
 if (!user || user.winTallyUSD < 1) return;
 let balance = user.winTallyUSD || 0;
 let add3x = 0;
 let add2x = 0;
 let add1x = 0;
 while (balance >= 3) {
 add3x++;
 balance -= 3;
 }
 while (balance >= 2) {
 add2x++;
 balance -= 2;
 }
 while (balance >= 1) {
 add1x++;
 balance -= 1;
 }
 try {
 const updateData = {};
 if (add3x > 0) updateData.credits3x = increment(add3x);
 if (add2x > 0) updateData.credits2x = increment(add2x);
 if (add1x > 0) updateData.credits1x = increment(add1x);
 updateData.winTallyUSD = balance; // Set to remaining (should be <1)
 await updateDoc(doc(db, 'users', user.wallet), updateData);
 const newUser = {
 ...user,
 credits3x: (user.credits3x || 0) + add3x,
 credits2x: (user.credits2x || 0) + add2x,
 credits1x: (user.credits1x || 0) + add1x,
 winTallyUSD: balance,
 };
 newUser.remainingTags = (3 - user.playsToday) + newUser.credits1x + newUser.credits2x + newUser.credits3x;
 setUser(newUser);
 setShowModal(false);
 Alert.alert('Success', 'Balance converted to tags!');
 } catch (error) {
 console.error('Convert error:', error);
 Alert.alert('Convert Failed', error.message || 'Unknown error');
 }
 };

 const withdrawBalance = async () => {
 if (!user || user.winTallyUSD < 50) return;
 setIsWithdrawing(true);
 try {
 const userRef = doc(db, 'users', user.wallet);
 const userSnap = await getDoc(userRef);
 const amountSol = user.winTallyUSD / parseFloat(solPrice);
 const lamports = Math.floor(amountSol * 1_000_000_000);
 const response = await fetch('https://graph-154197987323.us-central1.run.app', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ walletId: user.wallet, lamports })
 });
 if (!response.ok) throw new Error('Withdrawal failed');
 const { signature } = await response.json();
 console.log('Withdrawal tx:', signature);
 await updateDoc(userRef, { winTallyUSD: 0 });
 setUser({ ...user, winTallyUSD: 0 });
 setShowModal(false);
 setWithdrawSuccess(true);
 setTimeout(() => setWithdrawSuccess(false), 3000);
 } catch (error) {
 console.error('Withdraw error:', error);
 Alert.alert('Withdrawal Failed', error.message || 'Unknown error');
 } finally {
 setIsWithdrawing(false);
 }
 };

 const handleBalanceClick = () => {
 if (!user) return;
 if (user.winTallyUSD < 1) {
 Alert.alert('Low Balance', 'You need at least $1 to convert or $50 to withdraw.');
 return;
 }
 const sound = new Sound('ching.mp3', Sound.MAIN_BUNDLE, (error) => {
 if (error) console.error('Ching audio load error:', error);
 else sound.play();
 });
 setShowModal(true);
 };

 const handleCloseWin = () => {
 setGameState('idle');
 setPrediction(null);
 setStartPrice(null);
 };

 const aiColor = aiSuccess > 50 ? '#30F00E' : '#FF0400';

 const winAnimatedStyle = useAnimatedStyle(() => ({
 transform: [{ scale: winScale.value }],
 }));

 const loseAnimatedStyle = useAnimatedStyle(() => ({
 transform: [{ scale: loseScale.value }],
 }));

 // Animate on gameState change
 useEffect(() => {
 if (gameState === 'win') {
 winScale.value = withSpring(1, { duration: 500 });
 } else if (gameState === 'lose') {
 loseScale.value = withSpring(3.2, { duration: 750 });
 }
 }, [gameState]);

 const aspect = 1000 / 563;
 let imageWidth = screenWidth * 0.8;
 let imageHeight = imageWidth / aspect;
 if (imageHeight > screenHeight * 0.5) {
   imageHeight = screenHeight * 0.5;
   imageWidth = imageHeight * aspect;
 }

 return (
 <SafeAreaProvider>
 <StatusBar barStyle={useColorScheme() === 'dark' ? 'light-content' : 'dark-content'} />
 <ImageBackground source={require('./assets/bg1.png')} style={styles.container}>
 {/* Header */}
 <View style={styles.header}>
 <View style={styles.sponsored}>
 <Text style={styles.boldText}>Sponsored by:</Text>
 <TouchableOpacity onPress={() => Linking.openURL('https://solanaspaces.com/')}>
 <Image source={require('./assets/Brave.png')} style={styles.logo} />
 </TouchableOpacity>
 </View>
 <TouchableOpacity style={styles.walletButton} onPress={connectWallet}>
 <Text style={styles.buttonText}>{walletAddress ? 'Connected' : 'Connect Wallet'}</Text>
 </TouchableOpacity>
 </View>

 {/* Price Pill Above Inventory */}
 <View style={styles.priceContainer}>
 <View style={[styles.priceBox, isFlashing && styles.flash]}>
 <Image source={require('./assets/sl.png')} style={styles.solLogo} />
 <View style={styles.redDot} />
 <Text style={styles.priceText}>LIVE: ${solPrice}</Text>
 </View>
 </View>

 {/* Inventory */}
 {user && (
 <View style={styles.inventory}>
 <View style={styles.tagsRow}>
 <View style={styles.tagPill}>
 <Image source={require('./assets/can.png')} style={styles.canIcon} />
 <Text style={styles.tagText}>Free Tags: {3 - (user?.playsToday || 0)}</Text>
 </View>
 <View style={styles.tagPill}>
 <Image source={require('./assets/can.png')} style={styles.canIcon} />
 <Text style={styles.tagText}>1x: {user?.credits1x || 0}</Text>
 </View>
 <View style={styles.tagPill}>
 <Image source={require('./assets/can2.png')} style={styles.canIcon} />
 <Text style={styles.tagText}>2x: {user?.credits2x || 0}</Text>
 </View>
 <View style={styles.tagPill}>
 <Image source={require('./assets/can3.png')} style={styles.canIcon} />
 <Text style={styles.tagText}>3x: {user?.credits3x || 0}</Text>
 </View>
 </View>
 <TouchableOpacity style={styles.balancePill} onPress={handleBalanceClick}>
 <Text style={styles.tagText}>Balance: ${Number(user?.winTallyUSD || 0).toFixed(2)}</Text>
 </TouchableOpacity>
 </View>
 )}

 {/* Mobile Layout */}
 <View style={styles.main}>
 {!user ? (
 <View style={styles.center}>
 <Text style={styles.boldText}>Connect a Wallet</Text>
 <TouchableOpacity style={styles.tagButton} disabled={true}>
 <Text style={[styles.tagText, {color: '#F116A2'}]}>TAG IT!</Text>
 </TouchableOpacity>
 </View>
 ) : (user.remainingTags || 0) > 0 ? (
 <View style={styles.gameSection}>
 <View style={styles.arrowsRow}>
 <TouchableOpacity onPress={() => setPrediction('up')}>
 <Image source={require('./assets/up-arrow.png')} style={[styles.arrow, prediction === 'up' && styles.sprayBorderUp]} />
 </TouchableOpacity>
 <Image source={require('./assets/can.png')} style={styles.can} />
 <TouchableOpacity onPress={() => setPrediction('down')}>
 <Image source={require('./assets/down-arrow.png')} style={[styles.arrow, prediction === 'down' && styles.sprayBorderDown]} />
 </TouchableOpacity>
 </View>
 <View style={styles.selectors}>
 {[5, 10, 15].map(time => (
 <TouchableOpacity key={time} onPress={() => setSelectedTime(time)} style={[styles.selector, selectedTime === time && styles.selectedSelector]}>
 <Text style={styles.selectorText}>{time}sec</Text>
 </TouchableOpacity>
 ))}
 </View>
 <TouchableOpacity style={styles.tagButton} onPress={handleTagIt} disabled={gameState !== 'idle' || !prediction}>
 <Text style={[styles.tagText, {color: '#F116A2'}]}>TAG IT!</Text>
 </TouchableOpacity>
 </View>
 ) : (
 <View style={styles.buySection}>
 <View style={styles.featureCard}>
 <Text style={styles.boldText}>Come Back in: {countdown || 'Calculating...'}</Text>
 <Text style={styles.grayText}>OR</Text>
 </View>
 <ScrollView style={styles.buyGrid}>
 <View style={styles.featureCard}>
 <Text style={styles.boldText}>Buy 10 Tags</Text>
 <Text style={styles.text}>Upto <Text style={styles.greenText}>55%</Text></Text>
 <Text style={styles.grayText}>Predictive Rewards</Text>
 <Image source={require('./assets/can.png')} style={styles.canLarge} />
 <Text style={styles.text}>{(10 / parseFloat(solPrice)).toFixed(6)} SOL</Text>
 <TouchableOpacity style={styles.buyButton} onPress={() => handleBuyTags(10)}>
 <Text style={styles.tagText}>Buy Now</Text>
 </TouchableOpacity>
 </View>
 <View style={styles.featureCard}>
 <Text style={styles.boldText}>Buy 10 Tags</Text>
 <Text style={styles.text}>Upto <Text style={styles.greenText}>65%</Text></Text>
 <Text style={styles.grayText}>Predictive Rewards</Text>
 <Image source={require('./assets/can2.png')} style={styles.canLarge} />
 <Text style={styles.text}>{(20 / parseFloat(solPrice)).toFixed(6)} SOL</Text>
 <TouchableOpacity style={styles.buyButton} onPress={() => handleBuyTags(20)}>
 <Text style={styles.tagText}>Buy Now</Text>
 </TouchableOpacity>
 </View>
 <View style={styles.featureCard}>
 <Text style={styles.boldText}>Buy 10 Tags</Text>
 <Text style={styles.text}>Upto <Text style={styles.greenText}>75%</Text></Text>
 <Text style={styles.grayText}>Predictive Rewards</Text>
 <Image source={require('./assets/can3.png')} style={styles.canLarge} />
 <Text style={styles.text}>{(30 / parseFloat(solPrice)).toFixed(6)} SOL</Text>
 <TouchableOpacity style={styles.buyButton} onPress={() => handleBuyTags(30)}>
 <Text style={styles.tagText}>Buy Now</Text>
 </TouchableOpacity>
 </View>
 </ScrollView>
 </View>
 )}
 </View>

 {/* Popup */}
 {showPopup && (
 <Modal visible={showPopup} transparent={true} animationType="fade">
 <View style={styles.popup}>
 <Text style={styles.boldText}>Timer: {timer}s</Text>
 <View style={styles.popupContainer}>
 <Video source={require('./assets/chart.mp4')} style={styles.video} resizeMode="contain" muted paused={!videoPlaying} />
 </View>
 </View>
 </Modal>
 )}

 {/* Win */}
 {gameState === 'win' && (
 <AnimatedView style={[styles.winModal, winAnimatedStyle]}>
 <Image source={require('./assets/win-graphic.png')} style={{ width: imageWidth, height: imageHeight, resizeMode: 'contain' }} />
 <TouchableOpacity style={styles.shareButton} onPress={() => Linking.openURL(`https://x.com/intent/post?text=I%20nailed%20a%20${selectedTime}s%20${prediction.toUpperCase()}%20tag%20on%20@Graphittixyz%20and%20won%20${(getUsdReward(selectedTime, levelUsed) / parseFloat(solPrice)).toFixed(6)}%20SOL%20#Solana&url=${encodeURIComponent('https://example.com')}`)}>
 <Text style={styles.buttonText}>Share to X</Text>
 </TouchableOpacity>
 <TouchableOpacity style={styles.downloadButton} onPress={() => Linking.openURL('https://example.com/win-graphic.png')}>
 <Text style={styles.buttonText}>Download Image</Text>
 </TouchableOpacity>
 <TouchableOpacity style={styles.closeButton} onPress={handleCloseWin}>
 <Text style={styles.buttonText}>Close</Text>
 </TouchableOpacity>
 </AnimatedView>
 )}

 {/* Lose */}
 {gameState === 'lose' && (
 <AnimatedView style={[styles.loseMessage, loseAnimatedStyle]}>
 <Text style={styles.boldText}>Try Again!</Text>
 </AnimatedView>
 )}

 {/* Balance Modal */}
 {showModal && (
 <Modal visible={showModal} transparent={true} animationType="fade">
 <View style={styles.modalOverlay}>
 <View style={styles.modalContent}>
 <Text style={styles.modalText}>Convert into 1x, 2x, 3x, Prediction Tags</Text>
 <Text style={styles.modalText}>with Possible</Text>
 <Text style={styles.modalText}><Text style={{fontSize: 20, color: '#30F00E'}}>55%, 65%, 75%</Text></Text>
 <Text style={styles.modalText}>Prediction Rewards</Text>
 <TouchableOpacity style={styles.modalGlowGreen} onPress={convertBalance}>
 <Text style={[styles.tagText, {color: '#30F00E'}]}>Convert Now</Text>
 </TouchableOpacity>
 {Number(user.winTallyUSD) >= 50 && (
 <>
 <Text style={styles.modalText}>or</Text>
 <Text style={styles.modalText}>You can withdraw to your wallet.</Text>
 <TouchableOpacity style={styles.modalGlowPink} onPress={withdrawBalance} disabled={isWithdrawing}>
 <Text style={[styles.tagText, {color: '#F116A2'}]}>{isWithdrawing ? 'Withdrawing...' : 'Withdraw'}</Text>
 </TouchableOpacity>
 </>
 )}
 {Number(user.winTallyUSD) < 50 && (
 <Text style={styles.modalText}>Minimum $50 to Withdraw</Text>
 )}
 <TouchableOpacity style={styles.closeButton} onPress={() => setShowModal(false)}>
 <Text style={styles.buttonText}>Close</Text>
 </TouchableOpacity>
 </View>
 </View>
 </Modal>
 )}
 {isWithdrawing && <ActivityIndicator style={styles.withdrawLoading} />}
 {withdrawSuccess && <Text style={styles.withdrawSuccess}>Withdrawal Successful!</Text>}

 {/* Footer */}
 <View style={styles.footer}>
 <View style={styles.footerSection}>
 <Text style={styles.boldText}>Powered by:</Text>
 <Image source={require('./assets/drift.png')} style={styles.logo} />
 </View>
 <View style={styles.playersBox}>
 <Image source={require('./assets/graphitti.png')} style={styles.solLogo} />
 <View style={styles.redDot} />
 <Text style={styles.priceText}>Players: {userCount}</Text>
 </View>
 <View style={[styles.aiBox, isAiFlashing && styles.aiFlash, { borderColor: aiColor }]}>
 <Text style={styles.boldText}>Ai Success:</Text>
 <Text style={{ color: aiColor }}>{aiSuccess}%</Text>
 </View>
 </View>
 </ImageBackground>
 </SafeAreaProvider>
 );
}

const styles = StyleSheet.create({
 container: { flex: 1 },
 header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, flexWrap: 'wrap' },
 sponsored: { flexDirection: 'column', alignItems: 'flex-start', paddingRight: 8 },
 boldText: { fontWeight: 'bold', color: 'white', fontSize: 16 },
 logo: { width: 50, height: 35, resizeMode: 'contain' },
 walletButton: { backgroundColor: 'black', padding: 8, borderRadius: 9999, marginLeft: 'auto' },
 buttonText: { color: 'white', fontWeight: 'bold' },
 priceContainer: { width: '100%', alignItems: 'center' },
 priceBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'black', padding: 8, borderRadius: 9999, borderWidth: 2, borderColor: '#ec4899', marginTop: 8, marginBottom: 8, width: '100%', justifyContent: 'center' },
 solLogo: { width: 20, height: 20, borderRadius: 10 },
 redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'red', marginHorizontal: 4 },
 priceText: { color: 'white', fontWeight: 'bold' },
 flash: { borderColor: '#f472b6', shadowColor: '#f472b6', shadowOpacity: 1, shadowRadius: 10 },
 inventory: { flexDirection: 'row', justifyContent: 'flex-end', paddingRight: 8, flexWrap: 'wrap', marginBottom: 8, gap: 8 },
 tagsRow: { flexDirection: 'row', gap: 4 },
 tagPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'black', padding: 4, borderRadius: 9999, borderWidth: 2, borderColor: '#30F00E', shadowColor: '#30F00E', shadowOpacity: 0.5, shadowRadius: 5, minWidth: 70 },
 canIcon: { width: 12, height: 12 },
 tagText: { color: 'white', fontWeight: 'bold', paddingHorizontal: 4 },
 balancePill: { backgroundColor: 'black', padding: 4, borderRadius: 9999, borderWidth: 2, borderColor: 'yellow', shadowColor: '#FFD700', shadowOpacity: 0.5, shadowRadius: 5 },
 main: { flex: 1, alignItems: 'center', marginTop: 48, paddingHorizontal: 32, gap: 16 },
 center: { alignItems: 'center', gap: 8 },
 gameSection: { width: '100%', alignItems: 'center', gap: 8 },
 arrowsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 8 },
 arrow: { width: 48, height: 73, borderWidth: 2, borderColor: 'transparent', resizeMode: 'contain' },
 sprayBorderUp: { borderColor: 'green' },
 sprayBorderDown: { borderColor: 'red' },
 can: { width: 64, height: 96 },
 selectors: { flexDirection: 'row', gap: 8 },
 selector: { padding: 4, backgroundColor: 'black', borderRadius: 9999, borderWidth: 1, borderColor: 'transparent' },
 selectedSelector: { borderColor: '#ec4899', backgroundColor: '#831843' },
 selectorText: { color: 'white' },
 tagButton: { padding: 16, backgroundColor: 'black', borderRadius: 9999, shadowColor: '#ec4899', shadowOpacity: 1, shadowRadius: 20, borderWidth: 2, borderColor: '#ec4899' },
 buySection: { alignItems: 'center', gap: 24, paddingBottom: 80 },
 featureCard: { backgroundColor: 'black', padding: 24, borderRadius: 8, borderWidth: 2, borderColor: '#ec4899', alignItems: 'center', gap: 8 },
 grayText: { color: 'gray' },
 greenText: { color: '#30F00E' },
 canLarge: { width: 64, height: 64 },
 text: { color: 'white' },
 buyGrid: { flexDirection: 'column', gap: 24 },
 buyButton: { padding: 4, backgroundColor: 'black', borderRadius: 9999, shadowColor: '#ec4899', shadowOpacity: 0.5, shadowRadius: 10 },
 popup: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center' },
 popupContainer: { width: '90%', height: '50%', maxWidth: 400, maxHeight: 200, borderWidth: 1, borderColor: '#ccc', backgroundColor: 'white' },
 video: { flex: 1 },
 winModal: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: '-50%' }, { translateY: '-50%' }], alignItems: 'center', flexDirection: 'column', zIndex: 50 },
 loseMessage: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: '-50%' }, { translateY: '-50%' }], color: 'green', fontWeight: 'bold', fontSize: 32, shadowColor: 'green', shadowOpacity: 1, shadowRadius: 10, zIndex: 50 },
 footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', padding: 8 },
 footerSection: { flexDirection: 'column', alignItems: 'flex-start', gap: 4, paddingLeft: 8 },
 playersBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'black', padding: 4, borderRadius: 9999, borderWidth: 2, borderColor: '#30F00E', shadowColor: '#30F00E', shadowOpacity: 0.5, shadowRadius: 10 },
 aiBox: { flexDirection: 'column', alignItems: 'center', backgroundColor: 'black', padding: 8, borderRadius: 9999, borderWidth: 2, shadowOpacity: 0.5, shadowRadius: 10 },
 aiFlash: { shadowOpacity: 1, shadowRadius: 20 },
 modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center' },
 modalContent: { backgroundColor: 'black', padding: 24, borderRadius: 8, alignItems: 'center', borderWidth: 2, borderColor: '#F116A2', shadowColor: '#F116A2', shadowOpacity: 0.3, shadowRadius: 20, maxWidth: 300 },
 modalText: { color: 'white', fontSize: 16, textAlign: 'center', marginBottom: 8 },
 modalGlowGreen: { padding: 12, backgroundColor: 'black', borderRadius: 9999, shadowColor: '#30F00E', shadowOpacity: 0.5, shadowRadius: 15, width: '100%', alignItems: 'center', marginBottom: 8, borderWidth: 2, borderColor: '#30F00E' },
 modalGlowPink: { padding: 12, backgroundColor: 'black', borderRadius: 9999, shadowColor: '#F116A2', shadowOpacity: 0.5, shadowRadius: 15, width: '100%', alignItems: 'center', marginBottom: 8 },
 closeButton: { backgroundColor: 'gray', padding: 8, borderRadius: 9999, marginTop: 16, width: '100%', alignItems: 'center' },
 shareButton: { backgroundColor: 'black', padding: 8, borderRadius: 9999, marginTop: 8, shadowColor: '#ec4899', shadowOpacity: 0.5, shadowRadius: 10, borderWidth: 2, borderColor: '#ec4899' },
 downloadButton: { backgroundColor: 'black', padding: 8, borderRadius: 9999, marginTop: 4, shadowColor: 'gray', shadowOpacity: 0.5, shadowRadius: 10, borderWidth: 2, borderColor: 'gray' },
 withdrawLoading: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -12 }, { translateY: -12 }] },
 withdrawSuccess: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -150 }, { translateY: -50 }], backgroundColor: 'rgba(0,0,0,0.8)', padding: 16, borderRadius: 8, color: '#30F00E', fontWeight: 'bold', textAlign: 'center', width: 300, shadowColor: '#30F00E', shadowOpacity: 1, shadowRadius: 20 },
});