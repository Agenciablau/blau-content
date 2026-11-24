import {createRoot} from 'react-dom/client';
import Planner from './Planner';
import Splash from './Splash';
import './styles.css';
import './apple.css';
import './labs.css';
import './halo-select.css';
import './date-picker.css';
createRoot(document.getElementById('root')!).render(<><Planner/><Splash/></>);
