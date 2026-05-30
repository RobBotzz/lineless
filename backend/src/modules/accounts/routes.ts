import { Router } from 'express';
import { signup, login , deleteAccount, getAccountInfo, updateAccountInfo} from './service';

const accountRouter = Router();

accountRouter.post('/signup', signup);
accountRouter.post('/login', login);
accountRouter.delete('/delete', deleteAccount);
accountRouter.get('/info', getAccountInfo);
accountRouter.put('/update', updateAccountInfo);
export default accountRouter;