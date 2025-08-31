import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { WalletProvider } from './contexts/WalletContext';

const Root = () => <WalletProvider><App /></WalletProvider>;

AppRegistry.registerComponent(appName, () => Root);