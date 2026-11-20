import {createRoot} from 'react-dom/client';
import Planner from './Planner';
import Splash from './Splash';
import './styles.css';
import './apple.css';
import './labs.css';
createRoot(document.getElementById('root')!).render(<><Planner/><Splash/></>);
